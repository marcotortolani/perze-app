-- F9/A18 — índices faltantes en columnas de FK. La auditoría marcó puntualmente
-- `transactions.counter_account_id` (el `OR` de `recompute_account_balance` en
-- `20260801010700_transactions.sql` fuerza un scan sin esto), `categories.parent_id`,
-- `household_invites.household_id` y `visibility_grants.granted_by`; el resto salió
-- de un barrido completo de `information_schema` contra TODAS las FK de `public`
-- sin índice cubriente. `CREATE INDEX IF NOT EXISTS` — no toca las que ya existen
-- (household_id/las FK "raíz" del patrón A/B de RLS ya estaban cubiertas).
CREATE INDEX IF NOT EXISTS accounts_country_code_idx ON public.accounts (country_code);
CREATE INDEX IF NOT EXISTS accounts_created_by_idx ON public.accounts (created_by);
CREATE INDEX IF NOT EXISTS accounts_currency_code_idx ON public.accounts (currency_code);
CREATE INDEX IF NOT EXISTS accounts_institution_id_idx ON public.accounts (institution_id);
CREATE INDEX IF NOT EXISTS accounts_owner_id_idx ON public.accounts (owner_id);
CREATE INDEX IF NOT EXISTS asset_classes_household_id_idx ON public.asset_classes (household_id);
CREATE INDEX IF NOT EXISTS asset_classes_source_id_idx ON public.asset_classes (source_id);
CREATE INDEX IF NOT EXISTS audit_log_actor_id_idx ON public.audit_log (actor_id);
CREATE INDEX IF NOT EXISTS benchmarks_currency_code_idx ON public.benchmarks (currency_code);
CREATE INDEX IF NOT EXISTS budgets_category_id_idx ON public.budgets (category_id);
CREATE INDEX IF NOT EXISTS budgets_created_by_idx ON public.budgets (created_by);
CREATE INDEX IF NOT EXISTS budgets_currency_code_idx ON public.budgets (currency_code);
CREATE INDEX IF NOT EXISTS card_statements_currency_code_idx ON public.card_statements (currency_code);
CREATE INDEX IF NOT EXISTS categories_created_by_idx ON public.categories (created_by);
CREATE INDEX IF NOT EXISTS categories_owner_id_idx ON public.categories (owner_id);
CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON public.categories (parent_id);
CREATE INDEX IF NOT EXISTS countries_default_currency_idx ON public.countries (default_currency);
CREATE INDEX IF NOT EXISTS debt_schedule_transaction_id_idx ON public.debt_schedule (transaction_id);
CREATE INDEX IF NOT EXISTS debts_account_id_idx ON public.debts (account_id);
CREATE INDEX IF NOT EXISTS debts_created_by_idx ON public.debts (created_by);
CREATE INDEX IF NOT EXISTS debts_currency_code_idx ON public.debts (currency_code);
CREATE INDEX IF NOT EXISTS debts_household_id_idx ON public.debts (household_id);
CREATE INDEX IF NOT EXISTS debts_origin_transaction_id_idx ON public.debts (origin_transaction_id);
CREATE INDEX IF NOT EXISTS fx_overrides_created_by_idx ON public.fx_overrides (created_by);
CREATE INDEX IF NOT EXISTS goals_account_id_idx ON public.goals (account_id);
CREATE INDEX IF NOT EXISTS goals_created_by_idx ON public.goals (created_by);
CREATE INDEX IF NOT EXISTS goals_currency_code_idx ON public.goals (currency_code);
CREATE INDEX IF NOT EXISTS household_invites_accepted_by_idx ON public.household_invites (accepted_by);
CREATE INDEX IF NOT EXISTS household_invites_household_id_idx ON public.household_invites (household_id);
CREATE INDEX IF NOT EXISTS households_base_country_idx ON public.households (base_country);
CREATE INDEX IF NOT EXISTS households_base_currency_idx ON public.households (base_currency);
CREATE INDEX IF NOT EXISTS households_created_by_idx ON public.households (created_by);
CREATE INDEX IF NOT EXISTS import_batches_created_by_idx ON public.import_batches (created_by);
CREATE INDEX IF NOT EXISTS import_batches_household_id_idx ON public.import_batches (household_id);
CREATE INDEX IF NOT EXISTS insights_household_id_idx ON public.insights (household_id);
CREATE INDEX IF NOT EXISTS institutions_country_code_idx ON public.institutions (country_code);
CREATE INDEX IF NOT EXISTS institutions_household_id_idx ON public.institutions (household_id);
CREATE INDEX IF NOT EXISTS institutions_source_id_idx ON public.institutions (source_id);
CREATE INDEX IF NOT EXISTS instruments_asset_class_id_idx ON public.instruments (asset_class_id);
CREATE INDEX IF NOT EXISTS instruments_country_code_idx ON public.instruments (country_code);
CREATE INDEX IF NOT EXISTS instruments_currency_code_idx ON public.instruments (currency_code);
CREATE INDEX IF NOT EXISTS instruments_household_id_idx ON public.instruments (household_id);
CREATE INDEX IF NOT EXISTS instruments_source_id_idx ON public.instruments (source_id);
CREATE INDEX IF NOT EXISTS payees_default_account_id_idx ON public.payees (default_account_id);
CREATE INDEX IF NOT EXISTS payees_default_category_id_idx ON public.payees (default_category_id);
CREATE INDEX IF NOT EXISTS payees_household_id_idx ON public.payees (household_id);
CREATE INDEX IF NOT EXISTS portfolios_base_currency_idx ON public.portfolios (base_currency);
CREATE INDEX IF NOT EXISTS portfolios_broker_account_id_idx ON public.portfolios (broker_account_id);
CREATE INDEX IF NOT EXISTS portfolios_created_by_idx ON public.portfolios (created_by);
CREATE INDEX IF NOT EXISTS portfolios_household_id_idx ON public.portfolios (household_id);
CREATE INDEX IF NOT EXISTS price_snapshots_currency_code_idx ON public.price_snapshots (currency_code);
CREATE INDEX IF NOT EXISTS profiles_default_household_id_idx ON public.profiles (default_household_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_profile_id_idx ON public.push_subscriptions (profile_id);
CREATE INDEX IF NOT EXISTS recurring_rules_account_id_idx ON public.recurring_rules (account_id);
CREATE INDEX IF NOT EXISTS recurring_rules_category_id_idx ON public.recurring_rules (category_id);
CREATE INDEX IF NOT EXISTS recurring_rules_created_by_idx ON public.recurring_rules (created_by);
CREATE INDEX IF NOT EXISTS recurring_rules_currency_code_idx ON public.recurring_rules (currency_code);
CREATE INDEX IF NOT EXISTS rules_created_by_idx ON public.rules (created_by);
CREATE INDEX IF NOT EXISTS rules_household_id_idx ON public.rules (household_id);
CREATE INDEX IF NOT EXISTS settlements_created_by_idx ON public.settlements (created_by);
CREATE INDEX IF NOT EXISTS settlements_currency_code_idx ON public.settlements (currency_code);
CREATE INDEX IF NOT EXISTS settlements_from_member_idx ON public.settlements (from_member);
CREATE INDEX IF NOT EXISTS settlements_to_member_idx ON public.settlements (to_member);
CREATE INDEX IF NOT EXISTS settlements_transaction_id_idx ON public.settlements (transaction_id);
CREATE INDEX IF NOT EXISTS tags_household_id_idx ON public.tags (household_id);
CREATE INDEX IF NOT EXISTS trades_created_by_idx ON public.trades (created_by);
CREATE INDEX IF NOT EXISTS trades_currency_code_idx ON public.trades (currency_code);
CREATE INDEX IF NOT EXISTS trades_settlement_account_id_idx ON public.trades (settlement_account_id);
CREATE INDEX IF NOT EXISTS transaction_shares_settlement_id_idx ON public.transaction_shares (settlement_id);
CREATE INDEX IF NOT EXISTS transaction_splits_category_id_idx ON public.transaction_splits (category_id);
CREATE INDEX IF NOT EXISTS transactions_counter_account_id_idx ON public.transactions (counter_account_id);
CREATE INDEX IF NOT EXISTS transactions_counter_currency_code_idx ON public.transactions (counter_currency_code);
CREATE INDEX IF NOT EXISTS transactions_created_by_idx ON public.transactions (created_by);
CREATE INDEX IF NOT EXISTS transactions_currency_code_idx ON public.transactions (currency_code);
CREATE INDEX IF NOT EXISTS transactions_original_currency_idx ON public.transactions (original_currency);
CREATE INDEX IF NOT EXISTS transactions_recurring_id_idx ON public.transactions (recurring_id);
CREATE INDEX IF NOT EXISTS visibility_grants_granted_by_idx ON public.visibility_grants (granted_by);

