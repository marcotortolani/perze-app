/**
 * Traducción camelCase (Dexie) → snake_case (Postgres/Supabase) por tabla.
 * BASE-05 — el outbox drena las tablas donde el usuario ya escribe hoy vía
 * repo. `households` y `household_members` SÍ están mapeadas (B6: el owner
 * tiene que llegar al servidor para que el resto del onboarding tenga
 * membership real) — nota corregida, un comentario viejo acá decía lo
 * contrario. `profiles` sigue afuera: se crea vía el trigger
 * `handle_new_user` en Supabase, nunca desde un repo local.
 *
 * Todo `bigint` se serializa como `string` explícitamente — `JSON.stringify`
 * no sabe serializar `bigint` nativo (tira `TypeError`), y aunque supiera,
 * dejar que se redondee a `number` en el camino sería exactamente el bug
 * que `CLAUDE.md` prohíbe para plata.
 */

import { formatRate } from "../fx/rate";

export type SyncOp = "insert" | "update" | "delete";

export interface SyncTableConfig {
  /** Nombre de la tabla en Postgres. */
  supabaseTable: string;
  /** Traduce el payload guardado en el outbox (camelCase) a la fila de Postgres. */
  toRow: (payload: Record<string, unknown>) => Record<string, unknown>;
  /**
   * DELETE nunca se expone por RLS (`CLAUDE.md` § RLS) — todas las tablas
   * sincronizadas son soft-delete. Un op `"delete"` del outbox se traduce
   * siempre a `UPDATE ... SET deleted_at = now()`, nunca a un DELETE real.
   */
  deletedAtColumn: string;
  /**
   * CQ — antes de un UPDATE, compara `client_rev` contra lo que hay en el
   * servidor: si otro miembro ya subió una revisión más nueva mientras
   * esta fila estaba editada offline, es un conflicto real, no "el último
   * que sincroniza gana" en silencio. Solo tiene sentido en tablas que un
   * segundo miembro puede editar de verdad — por ahora, `transactions`.
   */
  conflictSensitive?: boolean;
}

function bigintToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  throw new Error(`Se esperaba bigint o null, llegó ${typeof value}`);
}

/**
 * Serializa un `ScaledRate` (bigint × 10^12, ver `lib/fx/rate.ts`) al decimal
 * plano que espera la columna `numeric(24,12)`. NUNCA usar `bigintToString`
 * para un rate — eso manda el entero escalado tal cual y Postgres lo lee
 * 10^12 veces más grande (A1 de la auditoría técnica).
 */
function rateToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return formatRate(value);
  throw new Error(`Se esperaba ScaledRate (bigint) o null, llegó ${typeof value}`);
}

export const SYNC_TABLES: Record<string, SyncTableConfig> = {
  households: {
    supabaseTable: "households",
    deletedAtColumn: "deleted_at",
    conflictSensitive: true,
    toRow: (p) => ({
      id: p.id,
      name: p.name,
      base_currency: p.baseCurrency,
      base_country: p.baseCountry,
      period_start_day: p.periodStartDay,
      week_start: p.weekStart,
      enabled_modules: p.enabledModules,
      settings: p.settings,
      created_by: p.createdBy,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      client_rev: p.clientRev,
    }),
  },

  household_members: {
    supabaseTable: "household_members",
    deletedAtColumn: "", // no tiene deleted_at — "former" (status) es la baja, no un borrado
    toRow: (p) => ({
      household_id: p.householdId,
      profile_id: p.profileId,
      role: p.role,
      display_name: p.displayName,
      color: p.color,
      icon: p.icon,
      status: "active",
      joined_at: p.joinedAt,
    }),
  },

  accounts: {
    supabaseTable: "accounts",
    deletedAtColumn: "deleted_at",
    conflictSensitive: true,
    toRow: (p) => ({
      id: p.id,
      household_id: p.householdId,
      owner_id: p.ownerId,
      name: p.name,
      kind: p.kind,
      institution_id: p.institutionId,
      country_code: p.countryCode,
      currency_code: p.currencyCode,
      opening_balance: bigintToString(p.openingBalance),
      opening_date: p.openingDate,
      // current_balance NUNCA se sincroniza: lo mantiene el trigger
      // `accounts_recompute_balance` (`20260811220000_...sql`) al insertar
      // o editar `opening_balance`, más `transactions_recompute_balance`
      // a partir de las transactions ya sincronizadas — pushearlo desde
      // acá pisaría el cálculo del servidor con un valor stale.
      credit_limit: bigintToString(p.creditLimit),
      statement_day: p.statementDay,
      due_day: p.dueDay,
      account_group_id: p.accountGroupId,
      interest_rate: p.interestRate,
      term_months: p.termMonths,
      include_in_net_worth: p.includeInNetWorth,
      visibility: p.visibility,
      color: p.color,
      icon: p.icon,
      sort_order: p.sortOrder,
      archived_at: p.archivedAt,
      created_by: p.createdBy,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      deleted_at: p.deletedAt,
      client_rev: p.clientRev,
    }),
  },

  account_groups: {
    supabaseTable: "account_groups",
    deletedAtColumn: "deleted_at",
    conflictSensitive: true,
    toRow: (p) => ({
      id: p.id,
      household_id: p.householdId,
      kind: p.kind,
      name: p.name,
      credit_limit: bigintToString(p.creditLimit),
      limit_currency: p.limitCurrency,
      statement_day: p.statementDay,
      due_day: p.dueDay,
      archived_at: p.archivedAt,
      created_by: p.createdBy,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      deleted_at: p.deletedAt,
      client_rev: p.clientRev,
    }),
  },

  categories: {
    supabaseTable: "categories",
    deletedAtColumn: "deleted_at",
    conflictSensitive: true,
    toRow: (p) => ({
      id: p.id,
      household_id: p.householdId,
      parent_id: p.parentId,
      name: p.name,
      icon: p.icon,
      color: p.color,
      kind: p.kind,
      nature: p.nature,
      is_system: p.isSystem,
      sort_order: p.sortOrder,
      archived_at: p.archivedAt,
      visibility: p.visibility,
      owner_id: p.ownerId,
      created_by: p.createdBy,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      deleted_at: p.deletedAt,
      client_rev: p.clientRev,
      // i18nKey es un concepto solo del cliente (traducción de la
      // plantilla de seed) — no existe columna en Postgres, no se manda.
    }),
  },

  tags: {
    supabaseTable: "tags",
    deletedAtColumn: "", // tags no tiene deleted_at — ver nota en drainOutbox()
    conflictSensitive: true,
    toRow: (p) => ({
      id: p.id,
      household_id: p.householdId,
      name: p.name,
      color: p.color,
      client_rev: p.clientRev,
    }),
  },

  /**
   * Sin `id` propio — PK compuesta `(transaction_id, tag_id)`, igual que
   * el Dexie `transactionTags: "[transactionId+tagId], ..."`. Nunca hay un
   * op `"update"` para esta tabla (la fila no tiene campos propios que
   * cambiar, solo existe o no existe) y el `"delete"` necesita un caso
   * especial en `syncOne` — `.eq("id", entry.entityId)` no tiene sentido
   * acá. `entityId` se arma como `"${transactionId}:${tagId}"`
   * (`transaction-tags-repo.ts`).
   */
  transaction_tags: {
    supabaseTable: "transaction_tags",
    deletedAtColumn: "",
    toRow: (p) => ({
      transaction_id: p.transactionId,
      tag_id: p.tagId,
    }),
  },

  payees: {
    supabaseTable: "payees",
    deletedAtColumn: "",
    conflictSensitive: true,
    toRow: (p) => ({
      id: p.id,
      household_id: p.householdId,
      name: p.name,
      default_category_id: p.defaultCategoryId,
      default_account_id: p.defaultAccountId,
      logo_url: p.logoUrl,
      aliases: p.aliases,
      client_rev: p.clientRev,
    }),
  },

  transactions: {
    supabaseTable: "transactions",
    deletedAtColumn: "deleted_at",
    conflictSensitive: true,
    toRow: (p) => ({
      id: p.id,
      household_id: p.householdId,
      created_by: p.createdBy,
      kind: p.kind,
      occurred_at: p.occurredAt,
      account_id: p.accountId,
      counter_account_id: p.counterAccountId,
      amount: bigintToString(p.amount),
      currency_code: p.currencyCode,
      original_amount: p.originalAmount === null ? null : bigintToString(p.originalAmount),
      original_currency: p.originalCurrency,
      original_rate: p.originalRate === null ? null : rateToString(p.originalRate),
      fx_rate: p.fxRate === null ? null : rateToString(p.fxRate),
      fx_source: p.fxSource,
      fx_provider: p.fxProvider,
      fx_quote_kind: p.fxQuoteKind,
      fx_resolved_at: p.fxResolvedAt,
      amount_base: p.amountBase === null ? null : bigintToString(p.amountBase),
      counter_amount: p.counterAmount === null ? null : bigintToString(p.counterAmount),
      counter_currency_code: p.counterCurrencyCode,
      counter_fx_rate: p.counterFxRate === null ? null : rateToString(p.counterFxRate),
      category_id: p.categoryId,
      payee_id: p.payeeId,
      note: p.note,
      attachments: p.attachments,
      location: p.location,
      status: p.status,
      visibility: p.visibility,
      recurring_id: p.recurringId,
      recurring_occurrence_date: p.recurringOccurrenceDate,
      installment_group_id: p.installmentGroupId,
      installment_number: p.installmentNumber,
      installment_total: p.installmentTotal,
      // A10 — antes hardcodeado a "ok": la columna que existe para que la
      // UI muestre "esto no se guardó" (D2/C12) siempre valía "ok" sin
      // importar qué pasó de verdad. `sync_state` es un campo LOCAL del
      // cliente (nunca lo escribe el servidor) que describe cómo terminó
      // el ÚLTIMO intento de sync — se manda tal cual está en la fila:
      // 'ok' en el camino feliz, y si esta fila se está resubiendo
      // después de un conflicto resuelto (`conflicts-repo.ts`), ya viene
      // en 'ok' desde ahí. Nunca 'rejected'/'conflict' en un upsert
      // exitoso — esos estados los pone `sync-worker.ts` localmente
      // cuando el intento FALLA, no acá.
      sync_state: p.syncState ?? "ok",
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      deleted_at: p.deletedAt,
      client_rev: p.clientRev,
      source: p.source,
      trade_id: p.tradeId,
    }),
  },

  budgets: {
    supabaseTable: "budgets",
    deletedAtColumn: "", // sin deleted_at — apagar es archived_at (nunca se borra)
    conflictSensitive: true,
    toRow: (p) => ({
      id: p.id,
      household_id: p.householdId,
      category_id: p.categoryId,
      name: p.name,
      amount_limit: bigintToString(p.amountLimit),
      currency_code: p.currencyCode,
      archived_at: p.archivedAt,
      created_by: p.createdBy,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      client_rev: p.clientRev,
    }),
  },

  goals: {
    supabaseTable: "goals",
    deletedAtColumn: "",
    conflictSensitive: true,
    toRow: (p) => ({
      id: p.id,
      household_id: p.householdId,
      name: p.name,
      icon: p.icon,
      color: p.color,
      target_amount: bigintToString(p.targetAmount),
      currency_code: p.currencyCode,
      target_date: p.targetDate,
      account_id: p.accountId,
      archived_at: p.archivedAt,
      created_by: p.createdBy,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      client_rev: p.clientRev,
    }),
  },

  recurring_rules: {
    supabaseTable: "recurring_rules",
    deletedAtColumn: "",
    conflictSensitive: true,
    toRow: (p) => ({
      id: p.id,
      household_id: p.householdId,
      name: p.name,
      kind: p.kind,
      category_id: p.categoryId,
      account_id: p.accountId,
      fallback_account_id: p.fallbackAccountId,
      expected_amount: bigintToString(p.expectedAmount),
      currency_code: p.currencyCode,
      frequency: p.frequency,
      anchor_date: p.anchorDate,
      day_of_month: p.dayOfMonth,
      auto_post: p.autoPost,
      end_date: p.endDate,
      archived_at: p.archivedAt,
      created_by: p.createdBy,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      client_rev: p.clientRev,
    }),
  },

  rules: {
    supabaseTable: "rules",
    deletedAtColumn: "deleted_at",
    conflictSensitive: true,
    toRow: (p) => ({
      id: p.id,
      household_id: p.householdId,
      name: p.name,
      priority: p.priority,
      match: p.match,
      actions: p.actions,
      is_active: p.isActive,
      hit_count: p.hitCount,
      created_by: p.createdBy,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      deleted_at: p.deletedAt,
      client_rev: p.clientRev,
    }),
  },
};
