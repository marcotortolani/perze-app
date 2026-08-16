import { createClient } from "../supabase/client";
import { getDb } from "../db/client";
import { withoutOutbox } from "./outbox";
import { fetchPaged } from "./paging";
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
import { parseRate } from "../fx/rate";
import { nowIso } from "../repos/ids";
import { BASIC_CATEGORY_TEMPLATE, COMPLETE_CATEGORY_TEMPLATE, type CategoryTemplateItem } from "../reference/category-templates";
import type {
  AccountGroupRow,
  AccountKind,
  AccountRow,
  Attachment,
  BudgetRow,
  CategorizationRuleRow,
  CategoryKind,
  CategoryNature,
  CategoryRow,
  EnabledModule,
  FxSourceValue,
  GoalRow,
  HouseholdMemberRow,
  HouseholdRole,
  HouseholdRow,
  PayeeRow,
  RecurringRuleRow,
  RuleActions,
  RuleMatch,
  TagRow,
  TransactionKind,
  TransactionRow,
  TransactionSource,
  TransactionStatus,
  Visibility,
} from "../db/schema";

/**
 * AC-1 de `docs/auditoria-acceso.md` — hidratación desde el servidor: baja
 * las once tablas sincronizadas al Dexie local. Es la contracara del outbox
 * (`sync-config.ts` sube; esto baja) y la pieza que faltaba para que un
 * usuario existente entre desde un dispositivo nuevo sin recrear nada.
 *
 * Reglas no negociables (mismas que el camino de subida):
 * - **Todo `bigint`/`numeric` viaja como `::text`** — PostgREST serializa
 *   `bigint` como número JSON y arriba de 2^53 pierde precisión EN SILENCIO.
 *   Mismo patrón que `mirror-repo.ts`/`debts-repo.ts`.
 * - Rates por `parseRate` (ScaledRate ×10¹²), nunca `parseFloat`.
 * - Los `bulkPut` corren dentro de `withoutOutbox()`: lo hidratado VIENE del
 *   servidor, re-encolarlo lo subiría de vuelta.
 * - Fidelidad sobre filtrado: las filas soft-deleted se bajan con su
 *   `deletedAt` (los repos locales ya saben filtrarlas). La única excepción
 *   es `households`, que no tiene `deletedAt` local — ahí sí se filtra.
 * - Modo completo (sin `householdId`): solo corre con la base local vacía —
 *   nunca pisa un dispositivo con ediciones pendientes en el outbox. Baja
 *   la LISTA de todos los households del usuario (households no se scopea
 *   nunca — la necesita el switcher), pero las tablas hijas solo del
 *   household activo (`profiles.default_household_id`, o el más viejo si
 *   no hay preferencia) — antes bajaba las hijas de TODOS los households
 *   mezcladas en las mismas tablas de Dexie, filtradas recién en cada query
 *   de pantalla. Modo scoped (`householdId`, para `/join` y el switcher):
 *   baja SOLO ese household, sin tocar el resto de la base local.
 */

/** `name` → `i18nKey` para reconstruir la clave de traducción que Postgres no tiene (igual que el backfill v2 de Dexie, pero sobre las DOS plantillas). */
const I18N_KEY_BY_NAME: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  const walk = (items: CategoryTemplateItem[]) => {
    for (const item of items) {
      map.set(item.name, item.i18nKey);
      if (item.children) walk(item.children);
    }
  };
  walk(BASIC_CATEGORY_TEMPLATE);
  walk(COMPLETE_CATEGORY_TEMPLATE);
  return map;
})();

function bigOf(value: unknown): bigint {
  if (typeof value !== "string") throw new Error(`Se esperaba un monto como string (::text), llegó ${typeof value}`);
  return BigInt(value);
}

function bigOfN(value: unknown): bigint | null {
  return value === null || value === undefined ? null : bigOf(value);
}

function rateOfN(value: unknown): bigint | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`Se esperaba un rate como string (::text), llegó ${typeof value}`);
  return parseRate(value);
}

// ---------------------------------------------------------------------------
// Mappers snake_case (fila PostgREST con casts ::text) → camelCase (Dexie).
// Exportados individualmente para testearlos como funciones puras.
// ---------------------------------------------------------------------------

export interface RawHousehold {
  id: string;
  name: string;
  base_currency: string;
  base_country: string | null;
  period_start_day: number;
  week_start: number;
  enabled_modules: string[];
  settings: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client_rev: number;
  /** `null` salvo que el owner haya corrido "Borrar todos mis datos" — ver `purge-reconcile.ts`. */
  purged_at: string | null;
}

export function householdFromRow(row: RawHousehold): HouseholdRow {
  return {
    id: row.id,
    name: row.name,
    baseCurrency: row.base_currency,
    baseCountry: row.base_country,
    periodStartDay: row.period_start_day,
    weekStart: row.week_start,
    enabledModules: (row.enabled_modules ?? []) as EnabledModule[],
    settings: (row.settings ?? {}) as Record<string, unknown>,
    createdBy: row.created_by ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientRev: row.client_rev,
    purgedAt: row.purged_at ?? null,
  };
}

export interface RawMember {
  household_id: string;
  profile_id: string;
  role: string;
  display_name: string | null;
  color: string | null;
  icon: string | null;
  status: string;
  joined_at: string | null;
}

export function memberFromRow(row: RawMember): HouseholdMemberRow {
  return {
    householdId: row.household_id,
    profileId: row.profile_id,
    role: row.role as HouseholdRole,
    displayName: row.display_name ?? "",
    color: row.color ?? "var(--primary-fill)",
    icon: row.icon ?? "user",
    joinedAt: row.joined_at ?? nowIso(),
  };
}

export interface RawAccount {
  id: string;
  household_id: string;
  owner_id: string;
  name: string;
  kind: string;
  institution_id: string | null;
  country_code: string | null;
  currency_code: string;
  opening_balance: string;
  opening_date: string | null;
  current_balance: string;
  credit_limit: string | null;
  statement_day: number | null;
  due_day: number | null;
  account_group_id: string | null;
  interest_rate: string | null;
  term_months: number | null;
  include_in_net_worth: boolean;
  visibility: string;
  color: string | null;
  icon: string | null;
  sort_order: number | null;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  client_rev: number;
}

export function accountFromRow(row: RawAccount): AccountRow {
  return {
    id: row.id,
    householdId: row.household_id,
    ownerId: row.owner_id,
    name: row.name,
    kind: row.kind as AccountKind,
    institutionId: row.institution_id,
    countryCode: row.country_code,
    currencyCode: row.currency_code,
    openingBalance: bigOf(row.opening_balance),
    openingDate: row.opening_date,
    // Del servidor tal cual, sin recomputar: RLS (`can_see`) puede ocultar
    // movimientos ajenos y un recompute local con datos parciales daría un
    // saldo falso. El trigger de Postgres es la fuente de verdad.
    currentBalance: bigOf(row.current_balance),
    creditLimit: bigOfN(row.credit_limit),
    statementDay: row.statement_day,
    dueDay: row.due_day,
    accountGroupId: row.account_group_id,
    interestRate: row.interest_rate,
    termMonths: row.term_months,
    includeInNetWorth: row.include_in_net_worth,
    visibility: row.visibility as Visibility | "custom",
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order ?? 0,
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    clientRev: row.client_rev,
  };
}

export interface RawAccountGroup {
  id: string;
  household_id: string;
  kind: string;
  name: string;
  credit_limit: string | null;
  limit_currency: string | null;
  statement_day: number | null;
  due_day: number | null;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  client_rev: number;
}

export function accountGroupFromRow(row: RawAccountGroup): AccountGroupRow {
  return {
    id: row.id,
    householdId: row.household_id,
    kind: row.kind as AccountGroupRow["kind"],
    name: row.name,
    creditLimit: bigOfN(row.credit_limit),
    limitCurrency: row.limit_currency,
    statementDay: row.statement_day,
    dueDay: row.due_day,
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    clientRev: row.client_rev,
  };
}

export interface RawCategory {
  id: string;
  household_id: string;
  parent_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  kind: string;
  nature: string;
  is_system: boolean;
  sort_order: number | null;
  archived_at: string | null;
  visibility: string;
  owner_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  client_rev: number;
}

export function categoryFromRow(row: RawCategory): CategoryRow {
  return {
    id: row.id,
    householdId: row.household_id,
    parentId: row.parent_id,
    name: row.name,
    // No existe columna en Postgres — se reconstruye por nombre desde las
    // plantillas, igual que el backfill de la versión 2 de Dexie. Una
    // categoría renombrada por el usuario queda `null` y se muestra con
    // `name`, que es exactamente el comportamiento local. `is_system` es la
    // guarda: sin ella, el copy-on-write de `detachFromTemplate` no
    // sobrevive el round trip — una categoría desprendida a la que solo se
    // le cambió el ícono (nombre intacto) se re-adjuntaría a la plantilla
    // apenas se re-hidrata en otro dispositivo, porque el nombre coincide.
    //
    // Límite conocido: localmente `detachFromTemplate` deja `i18nKey`
    // intacto para que `applyCategoryTemplate` reconozca esa clave como "ya
    // resuelta" y no cree una fila nueva (ver su comentario). Acá, en
    // cambio, SIEMPRE se reconstruye a `null` para una fila desprendida,
    // porque Postgres no guarda `i18nKey` y no hay forma de distinguir
    // "esta fila ya fue health alguna vez" de "esta fila nunca lo fue" sin
    // esa columna. Consecuencia: en un dispositivo nuevo (o tras un
    // reinstall/re-hidratado completo), una categoría desprendida pierde esa
    // identidad y un cambio de plantilla posterior podría volver a crear una
    // fila para esa clave. Cerrarlo del todo requeriría una columna nueva en
    // Postgres (`template_key`, nunca limpiada) — fuera de alcance mientras
    // el uso real sea de un solo dispositivo por household.
    i18nKey: row.is_system ? (I18N_KEY_BY_NAME.get(row.name) ?? null) : null,
    icon: row.icon ?? "tag",
    color: row.color ?? "var(--data-1)",
    kind: row.kind as CategoryKind,
    nature: row.nature as CategoryNature,
    isSystem: row.is_system,
    sortOrder: row.sort_order ?? 0,
    archivedAt: row.archived_at,
    visibility: row.visibility as Visibility | "custom",
    ownerId: row.owner_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    clientRev: row.client_rev,
  };
}

export interface RawTag {
  id: string;
  household_id: string;
  name: string;
  color: string | null;
  client_rev: number;
}

export function tagFromRow(row: RawTag): TagRow {
  return { id: row.id, householdId: row.household_id, name: row.name, color: row.color, clientRev: row.client_rev };
}

export interface RawPayee {
  id: string;
  household_id: string;
  name: string;
  default_category_id: string | null;
  default_account_id: string | null;
  logo_url: string | null;
  aliases: string[] | null;
  client_rev: number;
}

export function payeeFromRow(row: RawPayee): PayeeRow {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    defaultCategoryId: row.default_category_id,
    defaultAccountId: row.default_account_id,
    logoUrl: row.logo_url,
    aliases: row.aliases ?? [],
    clientRev: row.client_rev,
  };
}

export interface RawTransaction {
  id: string;
  household_id: string;
  created_by: string;
  kind: string;
  occurred_at: string;
  account_id: string;
  counter_account_id: string | null;
  amount: string;
  currency_code: string;
  original_amount: string | null;
  original_currency: string | null;
  original_rate: string | null;
  fx_rate: string | null;
  fx_source: string;
  fx_provider: string | null;
  fx_quote_kind: string | null;
  fx_resolved_at: string | null;
  amount_base: string | null;
  counter_amount: string | null;
  counter_currency_code: string | null;
  counter_fx_rate: string | null;
  category_id: string | null;
  payee_id: string | null;
  note: string | null;
  attachments: unknown;
  location: unknown;
  status: string;
  visibility: string;
  recurring_id: string | null;
  recurring_occurrence_date: string | null;
  installment_group_id: string | null;
  installment_number: number | null;
  installment_total: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  client_rev: number;
  source: string;
  trade_id: string | null;
}

export function transactionFromRow(row: RawTransaction): TransactionRow {
  return {
    id: row.id,
    householdId: row.household_id,
    createdBy: row.created_by,
    kind: row.kind as TransactionKind,
    occurredAt: row.occurred_at,
    accountId: row.account_id,
    counterAccountId: row.counter_account_id,
    amount: bigOf(row.amount),
    currencyCode: row.currency_code,
    originalAmount: bigOfN(row.original_amount),
    originalCurrency: row.original_currency,
    originalRate: rateOfN(row.original_rate),
    // El rate viene congelado del servidor y se guarda congelado — nunca se
    // recalcula (`CLAUDE.md` § FX). Un NULL acá ES un needs_fx legítimo.
    fxRate: rateOfN(row.fx_rate),
    fxSource: row.fx_source as FxSourceValue,
    fxProvider: row.fx_provider,
    fxQuoteKind: row.fx_quote_kind,
    fxResolvedAt: row.fx_resolved_at,
    amountBase: bigOfN(row.amount_base),
    counterAmount: bigOfN(row.counter_amount),
    counterCurrencyCode: row.counter_currency_code,
    counterFxRate: rateOfN(row.counter_fx_rate),
    categoryId: row.category_id,
    payeeId: row.payee_id,
    note: row.note,
    attachments: (row.attachments ?? []) as Attachment[],
    location: (row.location ?? null) as TransactionRow["location"],
    status: row.status as TransactionStatus,
    visibility: row.visibility as Visibility,
    recurringId: row.recurring_id,
    recurringOccurrenceDate: row.recurring_occurrence_date,
    installmentGroupId: row.installment_group_id,
    installmentNumber: row.installment_number,
    installmentTotal: row.installment_total,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    clientRev: row.client_rev,
    source: row.source as TransactionSource,
    tradeId: row.trade_id,
    // La fila existe en el servidor, así que su último sync fue exitoso por
    // definición — `sync_state` remoto puede traer un 'conflict' viejo de
    // otro dispositivo, pero para ESTE dispositivo no hay nada pendiente.
    syncState: "ok",
    syncError: null,
  };
}

export interface RawBudget {
  id: string;
  household_id: string;
  category_id: string | null;
  name: string;
  amount_limit: string;
  currency_code: string;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  client_rev: number;
  rollover_surplus: boolean;
  rollover_deficit: boolean;
  rollover_since: string | null;
}

export function budgetFromRow(row: RawBudget): BudgetRow {
  return {
    id: row.id,
    householdId: row.household_id,
    categoryId: row.category_id,
    name: row.name,
    amountLimit: bigOf(row.amount_limit),
    currencyCode: row.currency_code,
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientRev: row.client_rev,
    rolloverSurplus: row.rollover_surplus,
    rolloverDeficit: row.rollover_deficit,
    rolloverSince: row.rollover_since,
  };
}

export interface RawGoal {
  id: string;
  household_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  target_amount: string;
  currency_code: string;
  target_date: string | null;
  account_id: string | null;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  client_rev: number;
}

export function goalFromRow(row: RawGoal): GoalRow {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    targetAmount: bigOf(row.target_amount),
    currencyCode: row.currency_code,
    targetDate: row.target_date,
    accountId: row.account_id,
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientRev: row.client_rev,
  };
}

export interface RawRecurringRule {
  id: string;
  household_id: string;
  name: string;
  kind: string;
  category_id: string | null;
  account_id: string;
  fallback_account_id: string | null;
  expected_amount: string;
  currency_code: string;
  frequency: string;
  anchor_date: string;
  day_of_month: number | null;
  auto_post: boolean;
  end_date: string | null;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  client_rev: number;
}

export function recurringRuleFromRow(row: RawRecurringRule): RecurringRuleRow {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    kind: row.kind as "expense" | "income",
    categoryId: row.category_id,
    accountId: row.account_id,
    fallbackAccountId: row.fallback_account_id ?? null,
    expectedAmount: bigOf(row.expected_amount),
    currencyCode: row.currency_code,
    frequency: row.frequency as RecurringRuleRow["frequency"],
    anchorDate: row.anchor_date,
    dayOfMonth: row.day_of_month,
    autoPost: row.auto_post,
    endDate: row.end_date,
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientRev: row.client_rev,
  };
}

export interface RawRule {
  id: string;
  household_id: string;
  name: string;
  priority: number;
  match: unknown;
  actions: unknown;
  is_active: boolean;
  hit_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  client_rev: number;
}

export function ruleFromRow(row: RawRule): CategorizationRuleRow {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    priority: row.priority,
    match: row.match as RuleMatch,
    actions: row.actions as RuleActions,
    isActive: row.is_active,
    hitCount: row.hit_count,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    clientRev: row.client_rev,
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface HydrateOptions {
  /**
   * Scoped (p. ej. `/join`, recién aceptada la invitación): baja SOLO ese
   * household y lo activa, sin tocar el resto de la base local. Sin esto,
   * modo completo: solo corre con la base local vacía de households.
   */
  householdId?: string;
}

export interface HydrateResult {
  households: number;
  transactions: number;
  activeHouseholdId: string | null;
}

export async function hydrateFromRemote(options: HydrateOptions = {}): Promise<HydrateResult> {
  const scopedId = options.householdId ?? null;
  const db = getDb();
  const supabase = createClient();

  // Guard de no-clobber del modo completo: con households locales ya
  // presentes puede haber ediciones en el outbox — pisar eso con el estado
  // del servidor perdería datos. Idempotente: devolver lo que ya hay.
  if (!scopedId) {
    const existing = await db.households.count();
    if (existing > 0) {
      const currentId = (await db.meta.get("currentHouseholdId"))?.value as string | undefined;
      return { households: existing, transactions: await db.transactions.count(), activeHouseholdId: currentId ?? null };
    }
  }

  const householdsQuery = () => {
    let q = supabase.from("households").select(HOUSEHOLDS_COLUMNS).is("deleted_at", null).order("id");
    if (scopedId) q = q.eq("id", scopedId);
    return q;
  };
  const rawHouseholds = await fetchPaged((f, t) => householdsQuery().range(f, t));
  const households = rawHouseholds.map(householdFromRow);

  if (households.length === 0) {
    return { households: 0, transactions: 0, activeHouseholdId: null };
  }

  // Household activo: el scoped si lo hay; si no, `profiles.default_household_id`
  // (AC-3 — ahora se escribe al cerrar A11) y como último recurso el más viejo.
  // Se resuelve ACÁ, antes de bajar las tablas hijas, porque `scoped` lo usa
  // como scope por defecto — ver la nota de `scopeId` abajo.
  let activeHouseholdId = scopedId;
  if (!activeHouseholdId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("default_household_id").eq("id", user.id).maybeSingle();
      const preferred = profile?.default_household_id ?? null;
      if (preferred && households.some((h) => h.id === preferred)) activeHouseholdId = preferred;
    }
    activeHouseholdId ??= [...households].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]!.id;
  }

  // Household del que se bajan las tablas hijas: el scoped si lo hay, si no
  // el activo recién resuelto. Antes `scoped` era un no-op cuando `scopedId`
  // era null — el modo completo (`/onboarding/restore`) bajaba las tablas
  // hijas de TODOS los households del usuario mezcladas en las mismas
  // tablas de Dexie, y recién después elegía uno activo. Ahora siempre
  // filtra: el modo completo solo hidrata datos del household activo; los
  // demás quedan en la lista de `households` (sin scopear, ver arriba) pero
  // sin sus hijas — el switcher los hidrata bajo demanda vía modo scoped.
  const scopeId = activeHouseholdId;
  const scoped = <Q extends { eq: (col: string, v: string) => Q }>(q: Q): Q => q.eq("household_id", scopeId);

  const [rawMembers, rawAccounts, rawAccountGroups, rawCategories, rawTags, rawPayees, rawBudgets, rawGoals, rawRecurring, rawRules] = await Promise.all([
    fetchPaged((f, t) => scoped(supabase.from("household_members").select(HOUSEHOLD_MEMBERS_COLUMNS).order("household_id").order("profile_id")).range(f, t)),
    fetchPaged((f, t) => scoped(supabase.from("accounts").select(ACCOUNTS_COLUMNS).order("id")).range(f, t)),
    fetchPaged((f, t) => scoped(supabase.from("account_groups").select(ACCOUNT_GROUPS_COLUMNS).order("id")).range(f, t)),
    fetchPaged((f, t) => scoped(supabase.from("categories").select(CATEGORIES_COLUMNS).order("id")).range(f, t)),
    fetchPaged((f, t) => scoped(supabase.from("tags").select(TAGS_COLUMNS).order("id")).range(f, t)),
    fetchPaged((f, t) => scoped(supabase.from("payees").select(PAYEES_COLUMNS).order("id")).range(f, t)),
    // `as any` temporal — `rollover_surplus`/`rollover_deficit`/`rollover_since`
    // (`20260816090000_budget_rollover.sql`) todavía no están en los tipos
    // generados (`pnpm db:types` pendiente, requiere credenciales remotas
    // que esta sesión no tiene). `RawBudget` sigue siendo la fuente de
    // verdad del shape real de la fila — sacar este cast en cuanto se
    // regeneren los tipos.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver el comentario de arriba
    fetchPaged<RawBudget>((f, t) => scoped(supabase.from("budgets").select(BUDGETS_COLUMNS) as any).order("id").range(f, t)),
    fetchPaged((f, t) => scoped(supabase.from("goals").select(GOALS_COLUMNS).order("id")).range(f, t)),
    fetchPaged((f, t) => scoped(supabase.from("recurring_rules").select(RECURRING_RULES_COLUMNS).order("id")).range(f, t)),
    fetchPaged((f, t) => scoped(supabase.from("rules").select(RULES_COLUMNS).order("id")).range(f, t)),
  ]);

  const rawTransactions = await fetchPaged((f, t) => scoped(supabase.from("transactions").select(TRANSACTIONS_COLUMNS).order("occurred_at").order("id")).range(f, t));

  const members = rawMembers.filter((m) => m.status === "active").map(memberFromRow);
  const accounts = rawAccounts.map(accountFromRow);
  const accountGroups = rawAccountGroups.map(accountGroupFromRow);
  const categories = rawCategories.map(categoryFromRow);
  const tags = rawTags.map(tagFromRow);
  const payees = rawPayees.map(payeeFromRow);
  const budgets = rawBudgets.map(budgetFromRow);
  const goals = rawGoals.map(goalFromRow);
  const recurringRules = rawRecurring.map(recurringRuleFromRow);
  const rules = rawRules.map(ruleFromRow);
  const transactions = rawTransactions.map(transactionFromRow);

  await withoutOutbox(async () => {
    await db.transaction(
      "rw",
      [db.households, db.householdMembers, db.accounts, db.accountGroups, db.categories, db.tags, db.payees, db.transactions, db.budgets, db.goals, db.recurringRules, db.categorizationRules, db.meta],
      async () => {
        await db.households.bulkPut(households);
        await db.householdMembers.bulkPut(members);
        await db.accounts.bulkPut(accounts);
        await db.accountGroups.bulkPut(accountGroups);
        await db.categories.bulkPut(categories);
        await db.tags.bulkPut(tags);
        await db.payees.bulkPut(payees);
        await db.transactions.bulkPut(transactions);
        await db.budgets.bulkPut(budgets);
        await db.goals.bulkPut(goals);
        await db.recurringRules.bulkPut(recurringRules);
        await db.categorizationRules.bulkPut(rules);
        // Último paso, adentro de la misma transacción (mismo criterio que
        // `complete-onboarding.ts`): solo se activa un household completo.
        await db.meta.put({ key: "currentHouseholdId", value: activeHouseholdId });
      }
    );
  });

  return { households: households.length, transactions: transactions.length, activeHouseholdId };
}
