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

import type { BirthDatePrecision } from "@/lib/analytics/age";

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
  clientRev: number;
  /** `null` salvo que el owner haya corrido "Borrar todos mis datos" — ver `purge-reconcile.ts`. */
  purgedAt: string | null;
}

export type HouseholdRole = "owner" | "admin" | "member" | "viewer";

export interface HouseholdMemberRow {
  householdId: string;
  profileId: string;
  role: HouseholdRole;
  displayName: string;
  color: string;
  /** Ícono elegido por la persona (`IconName`) — copia denormalizada de `profiles.icon`, sincronizada por trigger; `profiles_select` es self-only y esto es lo que el resto del household puede leer. */
  icon: string;
  joinedAt: string;
}

export interface ProfileRow {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** Ícono elegido por la persona (`IconName`, Phosphor) — identidad de la cuenta, igual que `displayName`. */
  icon: string;
  locale: string;
  timezone: string | null;
  defaultHouseholdId: string | null;
  settings: Record<string, unknown>;
  /** Alineación de tipos con `profiles.birth_date` — esta tabla todavía no tiene wiring de sync (ver `sync-config.ts`), así que estos dos campos son inertes hasta que lo tenga. */
  birthDate: string | null;
  birthDatePrecision: BirthDatePrecision | null;
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

  /**
   * Tanda 4 — límite y ciclo de una tarjeta pasaron a vivir en
   * `AccountGroupRow` cuando la cuenta pertenece a uno (multi-moneda:
   * varias cuentas `credit_card`, un solo grupo dueño del límite/ciclo
   * compartido). Estas tres columnas siguen existiendo acá para las
   * tarjetas SIN agrupar (compatibilidad, caso de una sola moneda) — el
   * valor efectivo es `accountGroupId ? group.field : account.field`, ver
   * `effectiveCardCycleConfig()` en `lib/analytics/card-cycle.ts`.
   */
  creditLimit: bigint | null;
  statementDay: number | null;
  dueDay: number | null;
  /** `null` = tarjeta sin agrupar (usa sus propias `creditLimit`/`statementDay`/`dueDay` de arriba). */
  accountGroupId: string | null;

  interestRate: string | null; // decimal string, numeric(8,4)
  termMonths: number | null;

  includeInNetWorth: boolean;
  /** `accounts.visibility` en Postgres SÍ admite `custom` (a diferencia de `transactions`) — ver `visibility_grants`. */
  visibility: Visibility | "custom";
  color: string | null;
  icon: string | null;
  sortOrder: number;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  clientRev: number;
}

/**
 * Tanda 4 — pieza reutilizable, no un parche de tarjetas: agrupa cuentas
 * y les presta atributos compartidos. Hoy solo existe `kind: 'credit_card'`
 * (límite + ciclo de una tarjeta multi-moneda); las columnas específicas
 * de ese kind son nullable para dejar lugar a un `kind` futuro sin
 * romper esta fila. Ver la migración
 * `20260812090000_account_groups_card_multicurrency.sql`.
 */
export type AccountGroupKind = "credit_card";

export interface AccountGroupRow {
  id: string;
  householdId: string;
  kind: AccountGroupKind;
  name: string;

  /** Solo `kind: 'credit_card'` — nullable para cualquier otro kind futuro. */
  creditLimit: bigint | null;
  limitCurrency: string | null;
  /** Semilla de la PROYECCIÓN del ciclo — nunca la fecha real confirmada (`docs/`, § Tanda 4 tarjetas). */
  statementDay: number | null;
  dueDay: number | null;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  clientRev: number;
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
  /** J4 muestra visibilidad por categoría, no solo por cuenta. */
  visibility: Visibility | "custom";
  ownerId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Distinto de `archivedAt`: archivar es del usuario, borrar es soft-delete (`CLAUDE.md` § 2). */
  deletedAt: string | null;
  clientRev: number;
}

export interface TagRow {
  id: string;
  householdId: string;
  name: string;
  color: string | null;
  clientRev: number;
}

export interface PayeeRow {
  id: string;
  householdId: string;
  name: string;
  defaultCategoryId: string | null;
  defaultAccountId: string | null;
  logoUrl: string | null;
  aliases: string[];
  clientRev: number;
}

/** `investing` — settlement de una compra/venta de instrumento (Bloque I). Excluida de presupuestos y "gasto por categoría", igual que `transfer`/`adjustment`; el signo va en `amount` (negativo compra, positivo venta), no en el `kind`. */
export type TransactionKind = "expense" | "income" | "transfer" | "adjustment" | "investing";
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

  /**
   * SON DOS CONVERSIONES, NO UNA (`CLAUDE.md` § dinero). `amount`/
   * `currencyCode` están SIEMPRE en la moneda de la cuenta: mueven
   * `currentBalance` y no necesitan FX nunca.
   */
  amount: bigint;
  currencyCode: string;

  /**
   * Lo que el usuario gastó de verdad, cuando difiere de la moneda de la
   * cuenta (pagás USD con tarjeta en pesos: `amount`/`currencyCode` son los
   * pesos que salieron, esto es el dato original). Los tres son NULL o
   * ninguno — mismo invariante que la migración (`original_triple` CHECK).
   */
  originalAmount: bigint | null;
  originalCurrency: string | null;
  originalRate: bigint | null; // ScaledRate: originalCurrency → currencyCode

  /** Segunda conversión: moneda de la cuenta → moneda base. Acá vive needs_fx. */
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
  /** Trade que originó este movimiento (Bloque I, `kind: 'investing'`) — `null` para el resto. */
  tradeId: string | null;

  status: TransactionStatus;
  visibility: Visibility;

  recurringId: string | null;
  /**
   * YYYY-MM-DD — qué ocurrencia programada de la regla cubre este
   * movimiento, SIEMPRE presente cuando `recurringId` no es null, `null`
   * en cualquier otro caso. Es la clave real de idempotencia contra
   * duplicados (`transactions_recurring_occurrence_uniq`) — desacoplada
   * de `occurredAt` porque una carga manual tardía puede registrar el
   * movimiento con la fecha real de pago (hoy) mientras esta columna
   * sigue apuntando al período que salda (§ recurrentes, `CLAUDE.md`).
   */
  recurringOccurrenceDate: string | null;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  clientRev: number;
  source: TransactionSource;

  /**
   * `docs/01-arquitectura-datos.md` § 7, decisión 4: lo que nunca llegó al
   * servidor vive solo en el outbox y no tiene fila — así que `syncState`
   * describe cómo terminó el ÚLTIMO intento de sync de una fila que sí
   * existe local. `'conflict'` = otro miembro editó esta misma fila entre
   * que se guardó localmente y que se intentó subir (`client_rev`
   * desalineado) — ver `sync-worker.ts` y `conflicts-repo.ts`.
   */
  syncState: "ok" | "rejected" | "conflict";
  syncError: string | null;
}

export interface TransactionTagRow {
  transactionId: string;
  tagId: string;
}

/** A6 — mismos valores que `transactions.fxSource`; el hijo hereda el estado del padre (trigger `inherit_fx_state_splits`/propagación server-side). */
export type ChildFxSource = "identity" | "api" | "manual" | "inherited" | "pending";

export interface TransactionSplitRow {
  id: string;
  transactionId: string;
  categoryId: string;
  amount: bigint;
  amountBase: bigint | null;
  fxSource: ChildFxSource;
  note: string | null;
  /** CON-24: soft-delete, igual que el resto — nunca se expone un DELETE real. */
  deletedAt: string | null;
}

export type ShareSplitMode = "equal" | "income_pro_rata" | "exact" | "percent";

export interface TransactionShareRow {
  id: string;
  transactionId: string;
  memberId: string;
  shareAmount: bigint;
  shareAmountBase: bigint | null;
  fxSource: ChildFxSource;
  /** J5 muestra "62 y 38" — numeric(6,3) como string decimal. */
  sharePct: string | null;
  splitMode: ShareSplitMode | null;
  settledAt: string | null;
  settlementId: string | null;
  deletedAt: string | null;
}

export type SettlementMethod = "cash" | "transfer" | "forgiven" | "other";
export type SettlementStatus = "pending" | "done" | "forgiven";

export interface SettlementRow {
  id: string;
  householdId: string;
  fromMember: string;
  toMember: string;
  amount: bigint;
  currencyCode: string;
  /** Misma forma que transactions: needs_fx aplica acá también. */
  fxRate: bigint | null; // ScaledRate
  fxSource: FxSourceValue;
  amountBase: bigint | null;
  method: SettlementMethod | null;
  status: SettlementStatus;
  settledAt: string | null;
  transactionId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
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
  /** A8 — "" para cotizaciones de proveedor (globales, Patrón C, sin household); el household real para overrides manuales. */
  householdId: string;
}

export interface HouseholdFxPreferenceRow {
  householdId: string;
  currencyPair: string; // 'ARS/USD'
  preferredProvider: string | null;
  preferredQuoteKind: string | null;
}

export type OutboxOp = "insert" | "update" | "delete";
/**
 * `"conflict"` es terminal — no se reintenta solo, espera resolución
 * explícita (ver `conflicts-repo.ts`). `"dead"` también es terminal — pasó
 * el techo de reintentos automáticos (C9/C32) y espera reintento manual
 * desde la pantalla de diagnóstico en Más.
 */
export type OutboxStatus = "pending" | "syncing" | "failed" | "conflict" | "dead";

export interface OutboxEntryRow {
  id?: number; // autoIncrement — orden FIFO real (C8): nunca reordenar por status.
  table: string;
  op: OutboxOp;
  entityId: string;
  payload: unknown;
  clientRev: number;
  createdAt: string;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  /** Backoff exponencial con jitter (C9) — `null` hasta el primer fallo. `drainOutbox` no toma una entrada con `nextAttemptAt` en el futuro. */
  nextAttemptAt: string | null;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

/** Un conflicto real detectado al drenar el outbox — ver `sync-worker.ts`/`conflicts-repo.ts`. */
export interface ConflictRecordRow {
  id: string;
  table: string;
  entityId: string;
  /** El payload que el outbox intentó subir y el servidor rechazó por `client_rev` desalineado. */
  localPayload: Record<string, unknown>;
  /** La fila tal como está en el servidor en este momento. */
  serverPayload: Record<string, unknown>;
  detectedAt: string;
}

/**
 * Bloque F+G. Sin `budget_periods`/`goal_contributions`/`goal_accounts` a
 * propósito — ver la nota de la migración `20260801040000`.
 */
export interface BudgetRow {
  id: string;
  householdId: string;
  categoryId: string | null;
  name: string;
  amountLimit: bigint;
  currencyCode: string;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** C10 — antes hardcodeado a 1 en todos los repos salvo transactions: la detección de conflictos era ficticia. */
  clientRev: number;
}

export interface GoalRow {
  id: string;
  householdId: string;
  name: string;
  icon: string | null;
  color: string | null;
  targetAmount: bigint;
  currencyCode: string;
  targetDate: string | null;
  accountId: string | null;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  clientRev: number;
}

export type RecurringFrequency = "weekly" | "biweekly" | "monthly" | "yearly";

export interface RecurringRuleRow {
  id: string;
  householdId: string;
  name: string;
  kind: "expense" | "income";
  categoryId: string | null;
  accountId: string;
  /** Cuenta alternativa para "Cargar ahora" cuando la principal no alcanza — ver `src/lib/recurring/materialize.ts`. Solo la usan los recurrentes manuales; el motor automático la ignora. */
  fallbackAccountId: string | null;
  expectedAmount: bigint;
  currencyCode: string;
  frequency: RecurringFrequency;
  /** YYYY-MM-DD — fase del timeline (ver `src/lib/recurring/occurrences.ts`). */
  anchorDate: string;
  /** Solo mensual/anual; `null` en semanal/quincenal. */
  dayOfMonth: number | null;
  /** Switch "Auto-registro" — default `true`. En `false`, la regla nunca se materializa sola: el usuario la carga con "Cargar ahora". */
  autoPost: boolean;
  endDate: string | null;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  clientRev: number;
}

export type RuleMatchField = "note" | "payeeName";
export type RuleMatchOp = "contains" | "equals";

export interface RuleMatch {
  field: RuleMatchField;
  op: RuleMatchOp;
  value: string;
}

export interface RuleActions {
  categoryId: string | null;
  tagIds: string[];
  payeeId: string | null;
}

/**
 * Bloque I — operaciones de portfolio (`trades`, `20260801011010_investments.sql`).
 * Hija de `portfolios` (Patrón B, `CLAUDE.md` § schema decisión 6): sin
 * `householdId` propio, nunca se duplica — a qué household pertenece un
 * trade se resuelve con `EXISTS` sobre `portfolios`, igual que en RLS.
 * `portfolios` todavía no es local-first (`portfolios-repo.ts` sigue yendo
 * directo a Supabase, decisión explícita fuera de este alcance), así que
 * acá el índice útil es `portfolioId`, no `householdId`.
 *
 * A diferencia de la mayoría de las filas raíz/hija del sistema, `trades`
 * no tiene `updated_at` en Postgres (solo `created_at`) — la detección de
 * conflictos (`detectRevisionConflict`) compara únicamente `client_rev`,
 * nunca timestamps, así que no hace falta acá tampoco.
 */
export interface TradeRow {
  id: string;
  portfolioId: string;
  instrumentId: string;
  createdBy: string;
  kind:
    | "buy"
    | "sell"
    | "dividend"
    | "coupon"
    | "amortization"
    | "interest"
    | "split"
    | "merger"
    | "fee"
    | "tax"
    | "deposit"
    | "withdrawal"
    | "transfer_in"
    | "transfer_out"
    | "revaluation";
  executedAt: string; // ISO datetime
  quantity: number; // numeric(38,12) — cantidad de instrumento, no plata
  price: number; // numeric(38,12) — idem
  currencyCode: string;
  grossAmount: bigint;
  netAmount: bigint;
  settlementAccountId: string | null;
  /** Misma forma que `transactions`: needs_fx aplica acá también (`CLAUDE.md` § FX). */
  fxRate: bigint | null; // ScaledRate — NULL = needs_fx
  fxSource: FxSourceValue;
  fxResolvedAt: string | null;
  amountBase: bigint | null; // (fxRate === null) === (amountBase === null)
  note: string | null;
  createdAt: string;
  deletedAt: string | null;
  clientRev: number;
}

/** K7 — auto-categorización. `match`/`actions` viven en columnas jsonb en Supabase, ver `20260801011100_system.sql`. */
export interface CategorizationRuleRow {
  id: string;
  householdId: string;
  name: string;
  priority: number;
  match: RuleMatch;
  actions: RuleActions;
  isActive: boolean;
  hitCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  clientRev: number;
}
