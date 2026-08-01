import Dexie, { type EntityTable, type Table } from "dexie";
import type {
  AccountRow,
  BudgetRow,
  CategorizationRuleRow,
  CategoryRow,
  ConflictRecordRow,
  CountryRow,
  CurrencyRow,
  FxRateRow,
  GoalRow,
  HouseholdFxPreferenceRow,
  HouseholdMemberRow,
  HouseholdRow,
  InstitutionRow,
  MetaRow,
  OutboxEntryRow,
  PayeeRow,
  ProfileRow,
  RecurringRuleRow,
  SettlementRow,
  TagRow,
  TransactionRow,
  TransactionShareRow,
  TransactionSplitRow,
  TransactionTagRow,
} from "./schema";
import { BASIC_CATEGORY_TEMPLATE } from "../reference/category-templates";

/** name (ES, plantilla Básica) → i18nKey — solo para el backfill de `version(2)`. */
const CATEGORY_I18N_KEY_BY_NAME = new Map(BASIC_CATEGORY_TEMPLATE.map((c) => [c.name, c.i18nKey]));

/**
 * Base local-first de PERZE. Ninguna pantalla la toca directo — todo pasa
 * por `lib/repos/*`, que es la costura para enchufar Supabase después
 * (ver `docs/perze-plan-redesign-first-5-blocks.md`).
 */
export class PerzeDatabase extends Dexie {
  households!: EntityTable<HouseholdRow, "id">;
  /** Clave compuesta `[householdId+profileId]` — sin PK simple, `Table` liso. */
  householdMembers!: Table<HouseholdMemberRow>;
  profiles!: EntityTable<ProfileRow, "id">;
  currencies!: EntityTable<CurrencyRow, "code">;
  countries!: EntityTable<CountryRow, "code">;
  institutions!: EntityTable<InstitutionRow, "id">;
  accounts!: EntityTable<AccountRow, "id">;
  categories!: EntityTable<CategoryRow, "id">;
  tags!: EntityTable<TagRow, "id">;
  payees!: EntityTable<PayeeRow, "id">;
  transactions!: EntityTable<TransactionRow, "id">;
  /** Clave compuesta `[transactionId+tagId]`. */
  transactionTags!: Table<TransactionTagRow>;
  transactionSplits!: EntityTable<TransactionSplitRow, "id">;
  transactionShares!: EntityTable<TransactionShareRow, "id">;
  settlements!: EntityTable<SettlementRow, "id">;
  /** Clave compuesta `[base+quote+asOf+provider+quoteKind]`. */
  fxRates!: Table<FxRateRow>;
  /** Clave compuesta `[householdId+currencyPair]`. */
  householdFxPreferences!: Table<HouseholdFxPreferenceRow>;
  outbox!: EntityTable<OutboxEntryRow, "id">;
  meta!: EntityTable<MetaRow, "key">;
  budgets!: EntityTable<BudgetRow, "id">;
  goals!: EntityTable<GoalRow, "id">;
  recurringRules!: EntityTable<RecurringRuleRow, "id">;
  categorizationRules!: EntityTable<CategorizationRuleRow, "id">;
  conflicts!: EntityTable<ConflictRecordRow, "id">;

  constructor(name = "perze") {
    super(name);

    this.version(1).stores({
      households: "id, createdAt",
      householdMembers: "[householdId+profileId], householdId, profileId",
      profiles: "id",
      currencies: "code, isActive",
      countries: "code",
      institutions: "id, householdId, countryCode",
      accounts: "id, householdId, [householdId+archivedAt], currencyCode, deletedAt",
      categories: "id, householdId, [householdId+kind], parentId, archivedAt",
      tags: "id, householdId",
      payees: "id, householdId, name",
      transactions:
        "id, householdId, accountId, categoryId, payeeId, [householdId+occurredAt], deletedAt, occurredAt",
      transactionTags: "[transactionId+tagId], transactionId, tagId",
      transactionSplits: "id, transactionId",
      transactionShares: "id, transactionId, memberId",
      settlements: "id, householdId, fromMember, toMember",
      fxRates: "[base+quote+asOf+provider+quoteKind], [base+quote]",
      householdFxPreferences: "[householdId+currencyPair], householdId",
      outbox: "++id, status, createdAt, entityId",
      meta: "key",
    });

    /**
     * Suma `CategoryRow.i18nKey` (ver `schema.ts`). El backfill solo
     * traduce las 8 categorías de `BASIC_CATEGORY_TEMPLATE` por nombre
     * exacto — cualquier categoría creada o renombrada por el usuario
     * queda con `i18nKey: null` y se sigue mostrando con su `name` tal
     * cual, nunca se pierde ni se sobreescribe.
     */
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("categories")
          .toCollection()
          .modify((category: CategoryRow) => {
            category.i18nKey = CATEGORY_I18N_KEY_BY_NAME.get(category.name) ?? null;
          });
      });

    /** Bloque F+G — presupuestos, metas, recurrentes (ver `20260801040000` en Supabase). */
    this.version(3).stores({
      budgets: "id, householdId, categoryId, archivedAt",
      goals: "id, householdId, accountId, archivedAt",
      recurringRules: "id, householdId, accountId, categoryId, archivedAt",
    });

    /** K7 — reglas de auto-categorización (`rules` en Supabase, ver `20260801011100_system.sql`). */
    this.version(4).stores({
      categorizationRules: "id, householdId, [householdId+isActive], deletedAt",
    });

    /**
     * CQ — detección real de conflictos de sync (antes: `client_rev` se
     * mandaba a Supabase pero nada lo comparaba, así que dos ediciones
     * offline del mismo movimiento se resolvían con "el último que
     * sincroniza gana", en silencio — ver `sync-worker.ts`.
     */
    this.version(5)
      .stores({
        transactions:
          "id, householdId, accountId, categoryId, payeeId, [householdId+occurredAt], deletedAt, occurredAt, syncState",
        conflicts: "id, table, entityId, detectedAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("transactions")
          .toCollection()
          .modify((row: TransactionRow) => {
            row.syncState = "ok";
            row.syncError = null;
          });
      });

    /**
     * A8 — el override manual de FX no llevaba `householdId`: dos
     * households con el mismo par de monedas podían leerse el override
     * cruzado. Se agrega como campo indexado (no como parte de la clave
     * primaria — cambiar una PK compuesta ya poblada es una migración de
     * Dexie mucho más arriesgada que agregar un índice, y esto es
     * suficiente para que `getManualOverride`/`clearManualOverride`
     * filtren por household de verdad). Filas viejas backfillean a `""`
     * (quedan como si fueran globales — sin dato para saber a qué
     * household pertenecían).
     *
     * Nota de alcance: la clave primaria sigue siendo
     * `[base+quote+asOf+provider+quoteKind]`, así que dos households
     * escribiendo un override para el mismo par el mismo día TODAVÍA
     * pueden pisarse el uno al otro en el `put()` (colisión de escritura,
     * no de lectura) — cerrar eso del todo pide mover `householdId` a la
     * clave primaria, una migración más profunda que queda pendiente.
     */
    this.version(6)
      .stores({
        fxRates: "[base+quote+asOf+provider+quoteKind], [base+quote], [householdId+base+quote]",
      })
      .upgrade(async (tx) => {
        await tx
          .table("fxRates")
          .toCollection()
          .modify((row: FxRateRow) => {
            row.householdId = "";
          });
      });

    /**
     * C10 — `clientRev` estaba hardcodeado a `1` en el outbox de accounts/
     * categories/tags/payees/budgets/goals/recurringRules/households/
     * categorizationRules (todo salvo transactions): el versionado
     * optimista era ficticio, así que `detectRevisionConflict` nunca
     * podía detectar nada real. Se agrega la columna en las 9 tablas —
     * las filas existentes backfillean a 1 (mismo valor con el que ya
     * "nacían" antes, así que no hay salto raro en el próximo sync).
     */
    this.version(7)
      .stores({})
      .upgrade(async (tx) => {
        const tables = ["accounts", "categories", "tags", "payees", "budgets", "goals", "recurringRules", "households", "categorizationRules"];
        for (const name of tables) {
          await tx
            .table(name)
            .toCollection()
            .modify((row: { clientRev?: number }) => {
              row.clientRev = 1;
            });
        }
      });

    /**
     * C8/C9/C32 — el outbox se drenaba en orden de `status` (índice usado
     * por `where("status")`), no de llegada: una entrada vieja en
     * `"pending"` podía esperar detrás de una recién marcada `"failed"` si
     * el índice las intercalaba distinto. Ahora `listPending` itera la
     * tabla por PK (`++id`, monótono → FIFO real) y filtra en JS. Se suma
     * `nextAttemptAt` para el backoff exponencial con jitter; filas viejas
     * backfillean a `null` (elegibles de inmediato, mismo comportamiento
     * que tenían).
     */
    this.version(8)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("outbox")
          .toCollection()
          .modify((row: OutboxEntryRow) => {
            row.nextAttemptAt = null;
          });
      });
  }
}

let instance: PerzeDatabase | null = null;

/** Singleton — Dexie ya maneja una sola conexión física por nombre de DB. */
export function getDb(): PerzeDatabase {
  if (!instance) instance = new PerzeDatabase();
  return instance;
}

/** Solo para tests: fuerza una base fresca (con nombre propio) detrás del singleton. */
export function resetDbForTests(name: string): PerzeDatabase {
  instance = new PerzeDatabase(name);
  return instance;
}
