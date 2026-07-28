/**
 * Filas de Dexie (IndexedDB) — recorte de `docs/01-arquitectura-datos.md`
 * § 2 a lo que necesitan los bloques A–E. Los módulos apagados (budgets,
 * goals, recurring, debts, investments) no tienen tabla todavía: se suman
 * cuando se construya su bloque, con una migración de Dexie nueva, nunca
 * tocando las existentes.
 *
 * Convención de tipos: montos en `bigint` (unidades mínimas), tasas de
 * cambio en `bigint` escalado (`lib/fx/rate.ts`, `ScaledRate`). Fechas como
 * ISO string (`YYYY-MM-DD` para fechas civiles, ISO datetime completo para
 * timestamps) — Dexie no necesita `Date` nativo para poder indexar bien.
 */

export type EnabledModule = "budgets" | "goals" | "recurring" | "debts" | "investments" | "family";

export interface HouseholdRow {
  id: string;
  name: string;
  baseCurrency: string;
  baseCountry: string | null;
  periodStartDay: number;
  weekStart: number;
  enabledModules: EnabledModule[];
  settings: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type HouseholdRole = "owner" | "admin" | "member" | "viewer";

export interface HouseholdMemberRow {
  householdId: string;
  profileId: string;
  role: HouseholdRole;
  displayName: string;
  color: string;
  joinedAt: string;
}

export interface ProfileRow {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  timezone: string | null;
  defaultHouseholdId: string | null;
  settings: Record<string, unknown>;
}

export interface CurrencyRow {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  kind: "fiat" | "crypto";
  isActive: boolean;
}

export interface CountryRow {
  code: string;
  name: string;
  defaultCurrency: string;
  flagEmoji: string;
}

export interface InstitutionRow {
  id: string;
  householdId: string | null;
  name: string;
  countryCode: string;
  kind: string;
  logoUrl: string | null;
  color: string | null;
}

export type AccountKind =
  | "cash"
  | "checking"
  | "savings"
  | "credit_card"
  | "wallet"
  | "broker"
  | "loan"
  | "receivable"
  | "other";

export type Visibility = "private" | "household";

export interface AccountRow {
  id: string;
  householdId: string;
  ownerId: string;
  name: string;
  kind: AccountKind;
  institutionId: string | null;
  countryCode: string | null;
  currencyCode: string;

  openingBalance: bigint;
  openingDate: string | null;
  currentBalance: bigint;

  creditLimit: bigint | null;
  statementDay: number | null;
  dueDay: number | null;

  interestRate: string | null; // decimal string, numeric(8,4)
  termMonths: number | null;

  includeInNetWorth: boolean;
  visibility: Visibility;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type CategoryKind = "expense" | "income";
export type CategoryNature = "fixed" | "variable" | "discretionary";

export interface CategoryRow {
  id: string;
  householdId: string;
  parentId: string | null;
  name: string;
  /**
   * Clave de `reference.category.*` para categorías de la plantilla del
   * seed/onboarding — la UI la usa para traducir el nombre en vez de
   * `name`. `null` en categorías creadas o renombradas por el usuario,
   * que siempre se muestran con `name` tal cual (ver `messages/*.json`).
   */
  i18nKey: string | null;
  icon: string;
  color: string;
  kind: CategoryKind;
  nature: CategoryNature;
  isSystem: boolean;
  sortOrder: number;
  archivedAt: string | null;
}

export interface TagRow {
  id: string;
  householdId: string;
  name: string;
  color: string | null;
}

export interface PayeeRow {
  id: string;
  householdId: string;
  name: string;
  defaultCategoryId: string | null;
  defaultAccountId: string | null;
  logoUrl: string | null;
  aliases: string[];
}

export type TransactionKind = "expense" | "income" | "transfer" | "adjustment";
export type FxSourceValue = "identity" | "api" | "manual" | "inherited" | "pending";
export type TransactionStatus = "cleared" | "pending" | "scheduled" | "void";
export type TransactionSource = "manual" | "voice" | "import" | "recurring" | "rule";

export interface Attachment {
  path: string;
  mime: string;
  size: number;
  thumb: string | null;
}

export interface TransactionRow {
  id: string;
  householdId: string;
  createdBy: string;

  kind: TransactionKind;
  occurredAt: string; // ISO datetime

  accountId: string;
  counterAccountId: string | null;

  /** Siempre positivo salvo `adjustment`; el signo lo da `kind`. */
  amount: bigint;
  currencyCode: string;

  fxRate: bigint | null; // ScaledRate — NULL = needs_fx
  fxSource: FxSourceValue;
  fxProvider: string | null;
  fxQuoteKind: string | null;
  fxResolvedAt: string | null;
  amountBase: bigint | null; // (fxRate === null) === (amountBase === null)

  counterAmount: bigint | null;
  counterCurrencyCode: string | null;
  counterFxRate: bigint | null;

  categoryId: string | null;
  payeeId: string | null;
  note: string | null;
  attachments: Attachment[];
  location: { lat: number; lng: number; label: string } | null;

  status: TransactionStatus;
  visibility: Visibility;

  recurringId: string | null;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  clientRev: number;
  source: TransactionSource;
}

export interface TransactionTagRow {
  transactionId: string;
  tagId: string;
}

export interface TransactionSplitRow {
  id: string;
  transactionId: string;
  categoryId: string;
  amount: bigint;
  amountBase: bigint | null;
  note: string | null;
}

export interface TransactionShareRow {
  id: string;
  transactionId: string;
  memberId: string;
  shareAmount: bigint;
  shareAmountBase: bigint | null;
  settledAt: string | null;
  settlementId: string | null;
}

export interface SettlementRow {
  id: string;
  householdId: string;
  fromMember: string;
  toMember: string;
  amount: bigint;
  currencyCode: string;
  settledAt: string;
  transactionId: string | null;
}

export interface FxRateRow {
  base: string;
  quote: string;
  asOf: string; // YYYY-MM-DD
  provider: string;
  quoteKind: string;
  rate: bigint; // ScaledRate
  bid: bigint | null;
  ask: bigint | null;
  fetchedAt: string;
}

export interface HouseholdFxPreferenceRow {
  householdId: string;
  currencyPair: string; // 'ARS/USD'
  preferredProvider: string | null;
  preferredQuoteKind: string | null;
}

export type OutboxOp = "insert" | "update" | "delete";
export type OutboxStatus = "pending" | "syncing" | "failed";

export interface OutboxEntryRow {
  id?: number; // autoIncrement
  table: string;
  op: OutboxOp;
  entityId: string;
  payload: unknown;
  clientRev: number;
  createdAt: string;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
}

export interface MetaRow {
  key: string;
  value: unknown;
}
