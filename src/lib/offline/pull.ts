import type { EntityTable } from "dexie";
import { createClient } from "../supabase/client";
import { getDb } from "../db/client";
import { withoutOutbox } from "./outbox";
import { fetchKeyset, fetchPaged, type KeysetCursor } from "./paging";
import { fxRepo } from "../repos/fx-repo";
import { reconcileRemotePurge } from "./purge-reconcile";
import { watermarkKeyFor } from "./sync-keys";
import {
  ACCOUNTS_COLUMNS,
  ACCOUNT_GROUPS_COLUMNS,
  BUDGETS_COLUMNS,
  CATEGORIES_COLUMNS,
  GOALS_COLUMNS,
  HOUSEHOLD_MEMBERS_COLUMNS,
  HOUSEHOLDS_COLUMNS,
  PAYEES_COLUMNS,
  RECURRING_RULES_COLUMNS,
  RULES_COLUMNS,
  TAGS_COLUMNS,
  TRANSACTIONS_COLUMNS,
} from "./sync-columns";
import {
  accountFromRow,
  accountGroupFromRow,
  budgetFromRow,
  categoryFromRow,
  goalFromRow,
  householdFromRow,
  memberFromRow,
  payeeFromRow,
  recurringRuleFromRow,
  ruleFromRow,
  tagFromRow,
  transactionFromRow,
  type RawAccount,
  type RawAccountGroup,
  type RawBudget,
  type RawCategory,
  type RawGoal,
  type RawHousehold,
  type RawMember,
  type RawPayee,
  type RawRecurringRule,
  type RawRule,
  type RawTag,
  type RawTransaction,
} from "./hydrate";
import type { AccountGroupRow, BudgetRow, CategorizationRuleRow, CategoryRow, GoalRow, OutboxEntryRow, PayeeRow, RecurringRuleRow, TagRow } from "../db/schema";

/**
 * AC-14 (`docs/plan-sync-incremental.md`) — pull incremental: la contracara
 * de `hydrate.ts` (one-shot, al entrar en un dispositivo sin datos) para el
 * multi-dispositivo simultáneo. Corre en el mismo tick que `drainOutbox()`
 * (`use-sync-loop.ts`), siempre DESPUÉS del push.
 *
 * Reglas de la § 5 del plan, en una sola función para no repetirlas en cada
 * tabla: si el `entityId` tiene CUALQUIER fila en el outbox (pending,
 * failed, dead o conflict), la versión local no se pisa — está en camino al
 * servidor, o esperando resolución explícita, y de cualquier forma no hay
 * una versión del servidor que sea "más nueva" en un sentido útil todavía.
 */

const OVERLAP_MS = 5_000;
const EPOCH = new Date(0).toISOString();

// Reexportada desde `sync-keys.ts` (rompe un ciclo de imports con el purge,
// ver su comentario) — el household switcher (PR 3) sigue importándola de
// acá para decidir si un household ya tiene un pull incremental corrido y
// puede saltear el hydrate completo al cambiar a él.
export { watermarkKeyFor } from "./sync-keys";

async function blockedEntityIds(candidateIds: string[], table: string): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();
  const entries = await getDb().outbox.where("entityId").anyOf(candidateIds).toArray();
  return new Set(entries.filter((e) => e.table === table).map((e) => e.entityId));
}

/**
 * Cuentas cuyo saldo local no hay que pisar todavía: solo las que tienen una
 * entrada de `transactions` en un estado ACTIVO (`pending`/`syncing`/
 * `failed` en backoff) — una escritura de verdad en camino al servidor.
 * `conflict` y `dead` son terminales: no van a resolverse solas, y su
 * mutación nunca llegó al servidor, así que el saldo remoto es el correcto
 * y hay que dejar que lo pise. Antes esto era un booleano por household
 * completo (`hasPendingOutboxFor`): un solo conflicto en UNA cuenta
 * congelaba el saldo de TODAS las cuentas del household para siempre, en
 * cualquier dispositivo con esa entrada atascada.
 */
async function blockingAccountIds(): Promise<Set<string>> {
  const entries = await getDb()
    .outbox.toCollection()
    .filter((e: OutboxEntryRow) => e.table === "transactions")
    .toArray();
  const isActive = (e: OutboxEntryRow) => e.status === "pending" || e.status === "syncing" || e.status === "failed";
  // Para cada entidad con al menos una entrada activa se bloquean las
  // cuentas de TODAS sus entradas (también las viejas de la misma cola):
  // una edición pendiente que movió el movimiento de cuenta A a B solo
  // lleva B en su payload, pero el saldo optimista de A también se ajustó
  // y el del servidor todavía no. Si el insert ya sincronizó y solo queda
  // el update, la cuenta vieja no figura en ningún payload — ese caso se
  // corrige solo en el pull siguiente al push.
  const activeEntities = new Set(entries.filter(isActive).map((e) => e.entityId));
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!activeEntities.has(entry.entityId)) continue;
    const payload = entry.payload as { accountId?: string; counterAccountId?: string | null } | null;
    if (payload?.accountId) ids.add(payload.accountId);
    if (payload?.counterAccountId) ids.add(payload.counterAccountId);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// households — fila única, sin poda (nunca se borra desde acá).
// ---------------------------------------------------------------------------

/**
 * Devuelve el `purgedAt` que acaba de bajar (o `undefined` si no pudo leer
 * la fila) — `pullFromRemote` lo usa para decidir si hay que reconciliar un
 * purge remoto ANTES de pedir `transactions`, que es exactamente la tabla
 * que un purge deja en un estado que el pull incremental no sabe leer (ver
 * `purge-reconcile.ts`).
 */
async function refreshHousehold(householdId: string): Promise<string | null | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase.from("households").select(HOUSEHOLDS_COLUMNS).eq("id", householdId).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return undefined; // borrado o fuera de alcance — no es tema de F1 (ver "Riesgos conocidos" del plan)
  const blocked = await blockedEntityIds([householdId], "households");
  if (blocked.has(householdId)) return undefined;
  const row = householdFromRow(data as unknown as RawHousehold);
  await getDb().households.put(row);
  return row.purgedAt;
}

// ---------------------------------------------------------------------------
// household_members — clave compuesta [householdId+profileId], entityId
// `${householdId}:${profileId}` (ver households-repo.ts `addMember`).
// ---------------------------------------------------------------------------

async function refreshMembers(householdId: string): Promise<{ count: number; pruned: number }> {
  const db = getDb();
  const supabase = createClient();
  const rawMembers = await fetchPaged<RawMember>((f, t) =>
    supabase.from("household_members").select(HOUSEHOLD_MEMBERS_COLUMNS).eq("household_id", householdId).order("profile_id").range(f, t)
  );
  const active = rawMembers.filter((m) => m.status === "active").map(memberFromRow);
  const activeProfileIds = new Set(active.map((m) => m.profileId));

  const local = await db.householdMembers.where("householdId").equals(householdId).toArray();
  const localKeys = local.map((m) => `${m.householdId}:${m.profileId}`);
  const blocked = await blockedEntityIds(localKeys, "household_members");

  await db.householdMembers.bulkPut(active);

  const toDelete = local.filter((m) => !activeProfileIds.has(m.profileId) && !blocked.has(`${m.householdId}:${m.profileId}`));
  if (toDelete.length) {
    await db.householdMembers.bulkDelete(toDelete.map((m) => [m.householdId, m.profileId]));
  }
  return { count: active.length, pruned: toDelete.length };
}

// ---------------------------------------------------------------------------
// accounts — mismo refresh que el resto de las tablas chicas, MÁS la
// excepción de `currentBalance` (§ 1 y § 5 del plan): mientras el outbox
// tenga una entrada de `transactions` pendiente, el saldo remoto puede
// estar calculado sin esa transacción todavía — pisarlo produce el salto
// hacia atrás que el plan describe. Se preserva el valor local hasta que
// el outbox de transactions se vacíe.
// ---------------------------------------------------------------------------

async function refreshAccounts(householdId: string): Promise<{ count: number; pruned: number }> {
  const db = getDb();
  const supabase = createClient();
  const rawAccounts = await fetchPaged<RawAccount>((f, t) => supabase.from("accounts").select(ACCOUNTS_COLUMNS).eq("household_id", householdId).order("id").range(f, t));
  let rows = rawAccounts.map(accountFromRow);

  const blocked = await blockingAccountIds();
  if (blocked.size > 0) {
    const localById = new Map((await db.accounts.where("householdId").equals(householdId).toArray()).map((a) => [a.id, a]));
    rows = rows.map((r) => {
      if (!blocked.has(r.id)) return r;
      const local = localById.get(r.id);
      return local ? { ...r, currentBalance: local.currentBalance } : r;
    });
  }

  return commitSimpleTable(db.accounts, "accounts", householdId, rows);
}

async function refreshAccountGroups(householdId: string): Promise<{ count: number; pruned: number }> {
  const db = getDb();
  const supabase = createClient();
  const raw = await fetchPaged<RawAccountGroup>((f, t) => supabase.from("account_groups").select(ACCOUNT_GROUPS_COLUMNS).eq("household_id", householdId).order("id").range(f, t));
  return commitSimpleTable<AccountGroupRow>(db.accountGroups, "account_groups", householdId, raw.map(accountGroupFromRow));
}

// ---------------------------------------------------------------------------
// Refresh genérico para el resto de las tablas chicas: mismo patrón de
// fetch-completo + poda por diff de ids que `accounts`, sin la excepción de
// saldo. Compartido para no repetirlo ocho veces (§ 1 del plan).
// ---------------------------------------------------------------------------

async function commitSimpleTable<Row extends { id: string; householdId: string }>(
  table: EntityTable<Row, "id">,
  outboxTable: string,
  householdId: string,
  rows: Row[]
): Promise<{ count: number; pruned: number }> {
  const fetchedIds = new Set(rows.map((r) => r.id));
  const localIds = await table.where("householdId").equals(householdId).primaryKeys();
  const blocked = await blockedEntityIds(localIds as string[], outboxTable);

  await table.bulkPut(rows);

  const toPrune = localIds.filter((id) => !fetchedIds.has(id as string) && !blocked.has(id as string));
  if (toPrune.length) await table.bulkDelete(toPrune);

  return { count: rows.length, pruned: toPrune.length };
}

async function refreshCategories(householdId: string): Promise<{ count: number; pruned: number }> {
  const db = getDb();
  const supabase = createClient();
  const raw = await fetchPaged<RawCategory>((f, t) => supabase.from("categories").select(CATEGORIES_COLUMNS).eq("household_id", householdId).order("id").range(f, t));
  return commitSimpleTable<CategoryRow>(db.categories, "categories", householdId, raw.map(categoryFromRow));
}

async function refreshTags(householdId: string): Promise<{ count: number; pruned: number }> {
  const db = getDb();
  const supabase = createClient();
  const raw = await fetchPaged<RawTag>((f, t) => supabase.from("tags").select(TAGS_COLUMNS).eq("household_id", householdId).order("id").range(f, t));
  return commitSimpleTable<TagRow>(db.tags, "tags", householdId, raw.map(tagFromRow));
}

async function refreshPayees(householdId: string): Promise<{ count: number; pruned: number }> {
  const db = getDb();
  const supabase = createClient();
  const raw = await fetchPaged<RawPayee>((f, t) => supabase.from("payees").select(PAYEES_COLUMNS).eq("household_id", householdId).order("id").range(f, t));
  return commitSimpleTable<PayeeRow>(db.payees, "payees", householdId, raw.map(payeeFromRow));
}

async function refreshBudgets(householdId: string): Promise<{ count: number; pruned: number }> {
  const db = getDb();
  const supabase = createClient();
  // `as any` temporal — mismo motivo que en `hydrate.ts`: `pnpm db:types`
  // pendiente para `rollover_surplus`/`rollover_deficit`/`rollover_since`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver el comentario de arriba
  const raw = await fetchPaged<RawBudget>((f, t) => (supabase.from("budgets").select(BUDGETS_COLUMNS) as any).eq("household_id", householdId).order("id").range(f, t));
  return commitSimpleTable<BudgetRow>(db.budgets, "budgets", householdId, raw.map(budgetFromRow));
}

async function refreshGoals(householdId: string): Promise<{ count: number; pruned: number }> {
  const db = getDb();
  const supabase = createClient();
  const raw = await fetchPaged<RawGoal>((f, t) => supabase.from("goals").select(GOALS_COLUMNS).eq("household_id", householdId).order("id").range(f, t));
  return commitSimpleTable<GoalRow>(db.goals, "goals", householdId, raw.map(goalFromRow));
}

async function refreshRecurringRules(householdId: string): Promise<{ count: number; pruned: number }> {
  const db = getDb();
  const supabase = createClient();
  const raw = await fetchPaged<RawRecurringRule>((f, t) => supabase.from("recurring_rules").select(RECURRING_RULES_COLUMNS).eq("household_id", householdId).order("id").range(f, t));
  return commitSimpleTable<RecurringRuleRow>(db.recurringRules, "recurring_rules", householdId, raw.map(recurringRuleFromRow));
}

async function refreshRules(householdId: string): Promise<{ count: number; pruned: number }> {
  const db = getDb();
  const supabase = createClient();
  const raw = await fetchPaged<RawRule>((f, t) => supabase.from("rules").select(RULES_COLUMNS).eq("household_id", householdId).order("id").range(f, t));
  return commitSimpleTable<CategorizationRuleRow>(db.categorizationRules, "rules", householdId, raw.map(ruleFromRow));
}

// ---------------------------------------------------------------------------
// transactions — la única tabla incremental. Cursor por watermark (`meta`),
// paginado dentro del ciclo por keyset (`fetchKeyset`).
// ---------------------------------------------------------------------------

type RawTransactionKeyed = RawTransaction & { updated_at: string; id: string };

async function pullTransactions(householdId: string): Promise<{ count: number }> {
  const db = getDb();
  const supabase = createClient();
  const wmKey = watermarkKeyFor(householdId);
  const watermark = ((await db.meta.get(wmKey))?.value as string | undefined) ?? EPOCH;

  const rawRows = await fetchKeyset<RawTransactionKeyed>((cursor: KeysetCursor | null) => {
    const base = supabase
      .from("transactions")
      .select(TRANSACTIONS_COLUMNS)
      .eq("household_id", householdId)
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1000);
    // Parcial y SIN filtro de deleted_at (índice `transactions_household_updated_idx`)
    // — un delete de otro dispositivo tiene que llegar acá también.
    return cursor ? base.or(`updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.gt.${cursor.id})`) : base.gt("updated_at", watermark);
  });

  if (rawRows.length === 0) return { count: 0 };

  const rows = rawRows.map((r) => transactionFromRow(r));
  const blocked = await blockedEntityIds(
    rows.map((r) => r.id),
    "transactions"
  );
  const toPut = rows.filter((r) => !blocked.has(r.id));

  await withoutOutbox(async () => {
    if (toPut.length) await db.transactions.bulkPut(toPut);
  });

  // El watermark nunca avanza más allá de la fila bloqueada más vieja de
  // este lote: si avanzara, esa fila jamás se volvería a pedir (su
  // `updated_at` quedaría por debajo del próximo `gt`) hasta que alguien la
  // edite de nuevo. Se reintenta en cada ciclo hasta que su entrada de
  // outbox se resuelva (§ 5 del plan).
  const blockedRows = rawRows.filter((r) => blocked.has(r.id));
  const boundary =
    blockedRows.length > 0
      ? blockedRows.reduce((min, r) => (r.updated_at < min.updated_at ? r : min)).updated_at
      : rawRows.reduce((max, r) => (r.updated_at > max.updated_at ? r : max)).updated_at;
  const newWatermark = new Date(new Date(boundary).getTime() - OVERLAP_MS).toISOString();
  await db.meta.put({ key: wmKey, value: newWatermark });

  return { count: toPut.length };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface PullResult {
  transactions: number;
  accounts: number;
  accountGroups: number;
  categories: number;
  tags: number;
  payees: number;
  budgets: number;
  goals: number;
  recurringRules: number;
  rules: number;
  members: number;
  prunedTotal: number;
}

// `prunedTotal: 1`, no 0 — `invalidateAfterPull` decide si invalida el
// cache mirando exactamente dos señales (`transactions > 0` o
// `prunedTotal > 0`, ver su comentario). Una reconciliación de purge es la
// definición misma de "hubo un cambio real"; un `0` acá dejaría el
// calendario y la lista de `/transactions` pintando datos que Dexie ya no
// tiene hasta el próximo tick que sí traiga una novedad "de verdad".
const PURGE_RECONCILED_RESULT: PullResult = {
  transactions: 0,
  accounts: 0,
  accountGroups: 0,
  categories: 0,
  tags: 0,
  payees: 0,
  budgets: 0,
  goals: 0,
  recurringRules: 0,
  rules: 0,
  members: 0,
  prunedTotal: 1,
};

/**
 * Pull incremental de `transactions` + refresh completo del resto — F1/F2
 * de `docs/plan-sync-incremental.md`. Siempre corre DESPUÉS de
 * `drainOutbox()` en el mismo tick (`use-sync-loop.ts`): lo local pendiente
 * sube primero, así el merge tiene la foto más al día del propio outbox.
 *
 * `refreshHousehold` corre PRIMERO, antes que `pullTransactions` — a
 * propósito, invirtiendo el orden que tenía antes. Es la única forma de
 * enterarse de un purge remoto (`households.purged_at`) ANTES de pedirle a
 * `transactions` "todo lo nuevo desde mi watermark", que es exactamente la
 * pregunta equivocada cuando el servidor acaba de hacer un `DELETE` real
 * (ver `purge-reconcile.ts`). Si hubo reconciliación, se corta acá: Dexie
 * ya quedó vacío para este household y el watermark en cero, así que el
 * tick siguiente vuelve a traer lo que haya sobrevivido desde el principio.
 */
export async function pullFromRemote(householdId: string): Promise<PullResult> {
  const purgedAt = await refreshHousehold(householdId);
  if (await reconcileRemotePurge(householdId, purgedAt ?? null)) {
    return PURGE_RECONCILED_RESULT;
  }
  const tx = await pullTransactions(householdId);
  try {
    // Overrides manuales y preferencia de cotización (blue/CCL/oficial) del
    // household — sin esto, "qué tipo de cambio se está eligiendo" solo se
    // propagaba a otro dispositivo si alguien abría `/currencies` ahí. Va
    // en el mismo tick que el resto del pull, no en el camino de guardar un
    // gasto — no compite con el objetivo de <5s.
    await fxRepo.syncFromServer(householdId);
  } catch {
    // Sin red o error del servidor: las cotizaciones/overrides locales quedan como estaban.
  }
  const members = await refreshMembers(householdId);
  const accounts = await refreshAccounts(householdId);
  const accountGroups = await refreshAccountGroups(householdId);
  const categories = await refreshCategories(householdId);
  const tags = await refreshTags(householdId);
  const payees = await refreshPayees(householdId);
  const budgets = await refreshBudgets(householdId);
  const goals = await refreshGoals(householdId);
  const recurringRules = await refreshRecurringRules(householdId);
  const rules = await refreshRules(householdId);

  const prunedTotal = [members, accounts, accountGroups, categories, tags, payees, budgets, goals, recurringRules, rules].reduce((sum, r) => sum + r.pruned, 0);

  return {
    transactions: tx.count,
    accounts: accounts.count,
    accountGroups: accountGroups.count,
    categories: categories.count,
    tags: tags.count,
    payees: payees.count,
    budgets: budgets.count,
    goals: goals.count,
    recurringRules: recurringRules.count,
    rules: rules.count,
    members: members.count,
    prunedTotal,
  };
}
