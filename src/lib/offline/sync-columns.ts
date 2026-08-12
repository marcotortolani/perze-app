/**
 * AC-14 (`docs/plan-sync-incremental.md` § 1) — listas de columnas de cada
 * `select`, extraídas de `hydrate.ts` para que `pull.ts` no las duplique.
 * Todo `bigint`/`numeric` viaja como `::text` — ver la nota de precisión en
 * `hydrate.ts`.
 */

export const HOUSEHOLDS_COLUMNS =
  "id, name, base_currency, base_country, period_start_day, week_start, enabled_modules, settings, created_by, created_at, updated_at, client_rev, purged_at";

export const HOUSEHOLD_MEMBERS_COLUMNS = "household_id, profile_id, role, display_name, color, icon, status, joined_at";

export const ACCOUNTS_COLUMNS =
  "id, household_id, owner_id, name, kind, institution_id, country_code, currency_code, opening_balance::text, opening_date, current_balance::text, credit_limit::text, statement_day, due_day, interest_rate::text, term_months, include_in_net_worth, visibility, color, icon, sort_order, archived_at, created_by, created_at, updated_at, deleted_at, client_rev";

export const CATEGORIES_COLUMNS =
  "id, household_id, parent_id, name, icon, color, kind, nature, is_system, sort_order, archived_at, visibility, owner_id, created_by, created_at, updated_at, deleted_at, client_rev";

export const TAGS_COLUMNS = "id, household_id, name, color, client_rev";

export const PAYEES_COLUMNS = "id, household_id, name, default_category_id, default_account_id, logo_url, aliases, client_rev";

export const BUDGETS_COLUMNS =
  "id, household_id, category_id, name, amount_limit::text, currency_code, archived_at, created_by, created_at, updated_at, client_rev";

export const GOALS_COLUMNS =
  "id, household_id, name, icon, color, target_amount::text, currency_code, target_date, account_id, archived_at, created_by, created_at, updated_at, client_rev";

export const RECURRING_RULES_COLUMNS =
  "id, household_id, name, kind, category_id, account_id, fallback_account_id, expected_amount::text, currency_code, frequency, anchor_date, day_of_month, auto_post, end_date, archived_at, created_by, created_at, updated_at, client_rev";

export const RULES_COLUMNS =
  "id, household_id, name, priority, match, actions, is_active, hit_count, created_by, created_at, updated_at, deleted_at, client_rev";

export const TRANSACTIONS_COLUMNS =
  "id, household_id, created_by, kind, occurred_at, account_id, counter_account_id, amount::text, currency_code, original_amount::text, original_currency, original_rate::text, fx_rate::text, fx_source, fx_provider, fx_quote_kind, fx_resolved_at, amount_base::text, counter_amount::text, counter_currency_code, counter_fx_rate::text, category_id, payee_id, note, attachments, location, status, visibility, recurring_id, recurring_occurrence_date, installment_group_id, installment_number, installment_total, created_at, updated_at, deleted_at, client_rev, source, trade_id";
