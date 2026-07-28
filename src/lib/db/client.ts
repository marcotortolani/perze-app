import Dexie, { type EntityTable, type Table } from "dexie";
import type {
  AccountRow,
  CategoryRow,
  CountryRow,
  CurrencyRow,
  FxRateRow,
  HouseholdFxPreferenceRow,
  HouseholdMemberRow,
  HouseholdRow,
  InstitutionRow,
  MetaRow,
  OutboxEntryRow,
  PayeeRow,
  ProfileRow,
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
