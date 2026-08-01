/**
 * Traducción camelCase (Dexie) → snake_case (Postgres/Supabase) por tabla.
 * BASE-05 — el outbox solo puede drenar las tablas donde el usuario ya
 * escribe hoy vía repo (`accounts`, `categories`, `tags`, `payees`,
 * `transactions`); `households`/`household_members`/`profiles` quedan
 * afuera a propósito: su creación es un flujo de servidor (A7, Server
 * Action) que todavía no existe (C7), no un CRUD local.
 *
 * Todo `bigint` se serializa como `string` explícitamente — `JSON.stringify`
 * no sabe serializar `bigint` nativo (tira `TypeError`), y aunque supiera,
 * dejar que se redondee a `number` en el camino sería exactamente el bug
 * que `CLAUDE.md` prohíbe para plata.
 */

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

export const SYNC_TABLES: Record<string, SyncTableConfig> = {
  households: {
    supabaseTable: "households",
    deletedAtColumn: "deleted_at",
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
      status: "active",
      joined_at: p.joinedAt,
    }),
  },

  accounts: {
    supabaseTable: "accounts",
    deletedAtColumn: "deleted_at",
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
      // current_balance NUNCA se sincroniza: lo mantiene el trigger de
      // Postgres a partir de las transactions ya sincronizadas — pushearlo
      // desde acá pisaría el cálculo del servidor con un valor stale.
      credit_limit: bigintToString(p.creditLimit),
      statement_day: p.statementDay,
      due_day: p.dueDay,
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
    }),
  },

  categories: {
    supabaseTable: "categories",
    deletedAtColumn: "deleted_at",
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
      // i18nKey es un concepto solo del cliente (traducción de la
      // plantilla de seed) — no existe columna en Postgres, no se manda.
    }),
  },

  tags: {
    supabaseTable: "tags",
    deletedAtColumn: "", // tags no tiene deleted_at — ver nota en drainOutbox()
    toRow: (p) => ({
      id: p.id,
      household_id: p.householdId,
      name: p.name,
      color: p.color,
    }),
  },

  payees: {
    supabaseTable: "payees",
    deletedAtColumn: "",
    toRow: (p) => ({
      id: p.id,
      household_id: p.householdId,
      name: p.name,
      default_category_id: p.defaultCategoryId,
      default_account_id: p.defaultAccountId,
      logo_url: p.logoUrl,
      aliases: p.aliases,
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
      original_rate: p.originalRate === null ? null : bigintToString(p.originalRate),
      fx_rate: p.fxRate === null ? null : bigintToString(p.fxRate),
      fx_source: p.fxSource,
      fx_provider: p.fxProvider,
      fx_quote_kind: p.fxQuoteKind,
      fx_resolved_at: p.fxResolvedAt,
      amount_base: p.amountBase === null ? null : bigintToString(p.amountBase),
      counter_amount: p.counterAmount === null ? null : bigintToString(p.counterAmount),
      counter_currency_code: p.counterCurrencyCode,
      counter_fx_rate: p.counterFxRate === null ? null : bigintToString(p.counterFxRate),
      category_id: p.categoryId,
      payee_id: p.payeeId,
      note: p.note,
      attachments: p.attachments,
      location: p.location,
      status: p.status,
      visibility: p.visibility,
      recurring_id: p.recurringId,
      installment_group_id: p.installmentGroupId,
      installment_number: p.installmentNumber,
      installment_total: p.installmentTotal,
      sync_state: "ok",
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      deleted_at: p.deletedAt,
      client_rev: p.clientRev,
      source: p.source,
    }),
  },

  budgets: {
    supabaseTable: "budgets",
    deletedAtColumn: "", // sin deleted_at — apagar es archived_at (nunca se borra)
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
    }),
  },

  goals: {
    supabaseTable: "goals",
    deletedAtColumn: "",
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
    }),
  },

  recurring_rules: {
    supabaseTable: "recurring_rules",
    deletedAtColumn: "",
    toRow: (p) => ({
      id: p.id,
      household_id: p.householdId,
      name: p.name,
      kind: p.kind,
      category_id: p.categoryId,
      account_id: p.accountId,
      expected_amount: bigintToString(p.expectedAmount),
      currency_code: p.currencyCode,
      day_of_month: p.dayOfMonth,
      archived_at: p.archivedAt,
      created_by: p.createdBy,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    }),
  },

  rules: {
    supabaseTable: "rules",
    deletedAtColumn: "deleted_at",
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
    }),
  },
};
