export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_balance_snapshots: {
        Row: {
          account_id: string
          as_of: string
          balance: number
        }
        Insert: {
          account_id: string
          as_of: string
          balance: number
        }
        Update: {
          account_id?: string
          as_of?: string
          balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "account_balance_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          archived_at: string | null
          client_rev: number
          color: string | null
          country_code: string | null
          created_at: string
          created_by: string
          credit_limit: number | null
          currency_code: string
          current_balance: number
          deleted_at: string | null
          due_day: number | null
          household_id: string
          icon: string | null
          id: string
          include_in_net_worth: boolean
          institution_id: string | null
          interest_rate: number | null
          kind: string
          name: string
          opening_balance: number
          opening_date: string | null
          owner_id: string
          sort_order: number | null
          statement_day: number | null
          term_months: number | null
          updated_at: string
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          client_rev?: number
          color?: string | null
          country_code?: string | null
          created_at?: string
          created_by: string
          credit_limit?: number | null
          currency_code: string
          current_balance?: number
          deleted_at?: string | null
          due_day?: number | null
          household_id: string
          icon?: string | null
          id: string
          include_in_net_worth?: boolean
          institution_id?: string | null
          interest_rate?: number | null
          kind: string
          name: string
          opening_balance?: number
          opening_date?: string | null
          owner_id: string
          sort_order?: number | null
          statement_day?: number | null
          term_months?: number | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          client_rev?: number
          color?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string
          credit_limit?: number | null
          currency_code?: string
          current_balance?: number
          deleted_at?: string | null
          due_day?: number | null
          household_id?: string
          icon?: string | null
          id?: string
          include_in_net_worth?: boolean
          institution_id?: string | null
          interest_rate?: number | null
          kind?: string
          name?: string
          opening_balance?: number
          opening_date?: string | null
          owner_id?: string
          sort_order?: number | null
          statement_day?: number | null
          term_months?: number | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_classes: {
        Row: {
          color: string | null
          default_risk: string | null
          household_id: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          source_id: string | null
        }
        Insert: {
          color?: string | null
          default_risk?: string | null
          household_id?: string | null
          icon?: string | null
          id: string
          name: string
          sort_order?: number | null
          source_id?: string | null
        }
        Update: {
          color?: string | null
          default_risk?: string | null
          household_id?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_classes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_classes_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "asset_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          diff: Json | null
          entity: string
          entity_id: string
          household_id: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          diff?: Json | null
          entity: string
          entity_id: string
          household_id: string
          id?: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          diff?: Json | null
          entity?: string
          entity_id?: string
          household_id?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmark_series: {
        Row: {
          as_of: string
          benchmark_id: string
          close: number
        }
        Insert: {
          as_of: string
          benchmark_id: string
          close: number
        }
        Update: {
          as_of?: string
          benchmark_id?: string
          close?: number
        }
        Relationships: [
          {
            foreignKeyName: "benchmark_series_benchmark_id_fkey"
            columns: ["benchmark_id"]
            isOneToOne: false
            referencedRelation: "benchmarks"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmarks: {
        Row: {
          currency_code: string
          id: string
          name: string
          symbol: string
        }
        Insert: {
          currency_code: string
          id: string
          name: string
          symbol: string
        }
        Update: {
          currency_code?: string
          id?: string
          name?: string
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "benchmarks_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      budgets: {
        Row: {
          amount_limit: number
          archived_at: string | null
          category_id: string | null
          client_rev: number
          created_at: string
          created_by: string
          currency_code: string
          household_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          amount_limit: number
          archived_at?: string | null
          category_id?: string | null
          client_rev?: number
          created_at?: string
          created_by: string
          currency_code: string
          household_id: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          amount_limit?: number
          archived_at?: string | null
          category_id?: string | null
          client_rev?: number
          created_at?: string
          created_by?: string
          currency_code?: string
          household_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "budgets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      card_statements: {
        Row: {
          account_id: string
          closing_date: string
          created_at: string
          currency_code: string
          due_date: string
          id: string
          minimum_payment: number | null
          paid_amount: number
          period_end: string
          period_start: string
          settlement_transaction_id: string | null
          statement_balance: number
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          closing_date: string
          created_at?: string
          currency_code: string
          due_date: string
          id: string
          minimum_payment?: number | null
          paid_amount?: number
          period_end: string
          period_start: string
          settlement_transaction_id?: string | null
          statement_balance: number
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          closing_date?: string
          created_at?: string
          currency_code?: string
          due_date?: string
          id?: string
          minimum_payment?: number | null
          paid_amount?: number
          period_end?: string
          period_start?: string
          settlement_transaction_id?: string | null
          statement_balance?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statements_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "card_statements_settlement_transaction_id_fkey"
            columns: ["settlement_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          client_rev: number
          color: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          household_id: string
          icon: string | null
          id: string
          is_system: boolean
          kind: string
          name: string
          nature: string
          owner_id: string | null
          parent_id: string | null
          sort_order: number | null
          updated_at: string
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          client_rev?: number
          color?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          household_id: string
          icon?: string | null
          id: string
          is_system?: boolean
          kind: string
          name: string
          nature?: string
          owner_id?: string | null
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          client_rev?: number
          color?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          household_id?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          kind?: string
          name?: string
          nature?: string
          owner_id?: string | null
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          default_currency: string | null
          flag_emoji: string | null
          name: string
        }
        Insert: {
          code: string
          default_currency?: string | null
          flag_emoji?: string | null
          name: string
        }
        Update: {
          code?: string
          default_currency?: string | null
          flag_emoji?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "countries_default_currency_fkey"
            columns: ["default_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          decimals: number
          is_active: boolean
          kind: string
          name: string
          symbol: string
        }
        Insert: {
          code: string
          decimals?: number
          is_active?: boolean
          kind: string
          name: string
          symbol: string
        }
        Update: {
          code?: string
          decimals?: number
          is_active?: boolean
          kind?: string
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      debt_schedule: {
        Row: {
          debt_id: string
          due_date: string
          id: string
          interest_amount: number
          number: number
          paid_at: string | null
          principal_amount: number
          transaction_id: string | null
        }
        Insert: {
          debt_id: string
          due_date: string
          id: string
          interest_amount?: number
          number: number
          paid_at?: string | null
          principal_amount: number
          transaction_id?: string | null
        }
        Update: {
          debt_id?: string
          due_date?: string
          id?: string
          interest_amount?: number
          number?: number
          paid_at?: string | null
          principal_amount?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_schedule_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_schedule_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          account_id: string | null
          counterpart: string | null
          created_at: string
          created_by: string
          currency_code: string
          deleted_at: string | null
          direction: string
          household_id: string
          id: string
          installment_count: number | null
          interest_rate: number | null
          kind: string
          name: string
          origin_transaction_id: string | null
          principal: number
          start_date: string
          term_months: number | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          counterpart?: string | null
          created_at?: string
          created_by: string
          currency_code: string
          deleted_at?: string | null
          direction: string
          household_id: string
          id: string
          installment_count?: number | null
          interest_rate?: number | null
          kind: string
          name: string
          origin_transaction_id?: string | null
          principal: number
          start_date: string
          term_months?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          counterpart?: string | null
          created_at?: string
          created_by?: string
          currency_code?: string
          deleted_at?: string | null
          direction?: string
          household_id?: string
          id?: string
          installment_count?: number | null
          interest_rate?: number | null
          kind?: string
          name?: string
          origin_transaction_id?: string | null
          principal?: number
          start_date?: string
          term_months?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "debts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_origin_transaction_id_fkey"
            columns: ["origin_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_overrides: {
        Row: {
          base_currency: string
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          quote_currency: string
          rate: number
          reason: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          base_currency: string
          created_at?: string
          created_by?: string | null
          household_id: string
          id: string
          quote_currency: string
          rate: number
          reason?: string | null
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          base_currency?: string
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          quote_currency?: string
          rate?: number
          reason?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fx_overrides_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fx_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_overrides_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_overrides_quote_currency_fkey"
            columns: ["quote_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      fx_rate_monthly_averages: {
        Row: {
          avg_rate: number
          base: string
          computed_at: string
          quote: string
          sample_count: number
          year_month: string
        }
        Insert: {
          avg_rate: number
          base: string
          computed_at?: string
          quote: string
          sample_count: number
          year_month: string
        }
        Update: {
          avg_rate?: number
          base?: string
          computed_at?: string
          quote?: string
          sample_count?: number
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_rate_monthly_averages_base_fkey"
            columns: ["base"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fx_rate_monthly_averages_quote_fkey"
            columns: ["quote"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      fx_rates: {
        Row: {
          as_of: string
          ask: number | null
          base: string
          bid: number | null
          fetched_at: string
          provider: string
          quote: string
          quote_kind: string
          rate: number
        }
        Insert: {
          as_of: string
          ask?: number | null
          base: string
          bid?: number | null
          fetched_at?: string
          provider: string
          quote: string
          quote_kind?: string
          rate: number
        }
        Update: {
          as_of?: string
          ask?: number | null
          base?: string
          bid?: number | null
          fetched_at?: string
          provider?: string
          quote?: string
          quote_kind?: string
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "fx_rates_base_fkey"
            columns: ["base"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fx_rates_quote_fkey"
            columns: ["quote"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      goals: {
        Row: {
          account_id: string | null
          archived_at: string | null
          client_rev: number
          color: string | null
          created_at: string
          created_by: string
          currency_code: string
          household_id: string
          icon: string | null
          id: string
          name: string
          target_amount: number
          target_date: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          archived_at?: string | null
          client_rev?: number
          color?: string | null
          created_at?: string
          created_by: string
          currency_code: string
          household_id: string
          icon?: string | null
          id: string
          name: string
          target_amount: number
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          archived_at?: string | null
          client_rev?: number
          color?: string | null
          created_at?: string
          created_by?: string
          currency_code?: string
          household_id?: string
          icon?: string | null
          id?: string
          name?: string
          target_amount?: number
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "goals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_fx_preferences: {
        Row: {
          created_at: string
          currency_pair: string
          household_id: string
          preferred_provider: string | null
          preferred_quote_kind: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_pair: string
          household_id: string
          preferred_provider?: string | null
          preferred_quote_kind?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_pair?: string
          household_id?: string
          preferred_provider?: string | null
          preferred_quote_kind?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_fx_preferences_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          accepted_by: string | null
          code: string
          created_at: string
          email: string | null
          expires_at: string
          household_id: string
          id: string
          revoked_at: string | null
          role: string
        }
        Insert: {
          accepted_by?: string | null
          code: string
          created_at?: string
          email?: string | null
          expires_at?: string
          household_id: string
          id: string
          revoked_at?: string | null
          role: string
        }
        Update: {
          accepted_by?: string | null
          code?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          household_id?: string
          id?: string
          revoked_at?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          color: string | null
          display_name: string | null
          household_id: string
          icon: string
          joined_at: string | null
          left_at: string | null
          profile_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          display_name?: string | null
          household_id: string
          icon?: string
          joined_at?: string | null
          left_at?: string | null
          profile_id: string
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          display_name?: string | null
          household_id?: string
          icon?: string
          joined_at?: string | null
          left_at?: string | null
          profile_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          base_country: string | null
          base_currency: string
          client_rev: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          enabled_modules: string[]
          id: string
          name: string
          period_start_day: number
          settings: Json
          updated_at: string
          week_start: number
        }
        Insert: {
          base_country?: string | null
          base_currency: string
          client_rev?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          enabled_modules?: string[]
          id: string
          name: string
          period_start_day?: number
          settings?: Json
          updated_at?: string
          week_start?: number
        }
        Update: {
          base_country?: string | null
          base_currency?: string
          client_rev?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          enabled_modules?: string[]
          id?: string
          name?: string
          period_start_day?: number
          settings?: Json
          updated_at?: string
          week_start?: number
        }
        Relationships: [
          {
            foreignKeyName: "households_base_country_fkey"
            columns: ["base_country"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "households_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "households_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string
          created_by: string
          filename: string
          household_id: string
          id: string
          mapping: Json | null
          row_count: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          filename: string
          household_id: string
          id: string
          mapping?: Json | null
          row_count?: number | null
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          filename?: string
          household_id?: string
          id?: string
          mapping?: Json | null
          row_count?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          created_at: string
          dismissed_at: string | null
          household_id: string
          id: string
          kind: string
          payload: Json
          period_end: string | null
          period_start: string | null
          severity: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          household_id: string
          id: string
          kind: string
          payload: Json
          period_end?: string | null
          period_start?: string | null
          severity: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          household_id?: string
          id?: string
          kind?: string
          payload?: Json
          period_end?: string | null
          period_start?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          color: string
          country_code: string | null
          household_id: string | null
          id: string
          kind: string
          logo_url: string | null
          name: string
          source_id: string | null
        }
        Insert: {
          color: string
          country_code?: string | null
          household_id?: string | null
          id: string
          kind: string
          logo_url?: string | null
          name: string
          source_id?: string | null
        }
        Update: {
          color?: string
          country_code?: string | null
          household_id?: string | null
          id?: string
          kind?: string
          logo_url?: string | null
          name?: string
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institutions_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "institutions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          amortization_schedule: Json | null
          asset_class_id: string | null
          country_code: string | null
          coupon_frequency: number | null
          coupon_rate: number | null
          currency_code: string
          cusip: string | null
          exchange: string | null
          household_id: string | null
          id: string
          is_manual: boolean
          isin: string | null
          issuer: string | null
          maturity_date: string | null
          metadata: Json
          name: string
          price_provider: string | null
          provider_symbol: string | null
          ratio: number | null
          source_id: string | null
          symbol: string
          underlying_symbol: string | null
        }
        Insert: {
          amortization_schedule?: Json | null
          asset_class_id?: string | null
          country_code?: string | null
          coupon_frequency?: number | null
          coupon_rate?: number | null
          currency_code: string
          cusip?: string | null
          exchange?: string | null
          household_id?: string | null
          id: string
          is_manual?: boolean
          isin?: string | null
          issuer?: string | null
          maturity_date?: string | null
          metadata?: Json
          name: string
          price_provider?: string | null
          provider_symbol?: string | null
          ratio?: number | null
          source_id?: string | null
          symbol: string
          underlying_symbol?: string | null
        }
        Update: {
          amortization_schedule?: Json | null
          asset_class_id?: string | null
          country_code?: string | null
          coupon_frequency?: number | null
          coupon_rate?: number | null
          currency_code?: string
          cusip?: string | null
          exchange?: string | null
          household_id?: string | null
          id?: string
          is_manual?: boolean
          isin?: string | null
          issuer?: string | null
          maturity_date?: string | null
          metadata?: Json
          name?: string
          price_provider?: string | null
          provider_symbol?: string | null
          ratio?: number | null
          source_id?: string | null
          symbol?: string
          underlying_symbol?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instruments_asset_class_id_fkey"
            columns: ["asset_class_id"]
            isOneToOne: false
            referencedRelation: "asset_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instruments_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "instruments_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "instruments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instruments_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          budget_alerts: boolean
          card_statement_due: boolean
          created_at: string
          household_id: string
          household_joined: boolean
          id: string
          insights: boolean
          profile_id: string
          recurring_reminders: boolean
          updated_at: string
          weekly_summary: boolean
        }
        Insert: {
          budget_alerts?: boolean
          card_statement_due?: boolean
          created_at?: string
          household_id: string
          household_joined?: boolean
          id: string
          insights?: boolean
          profile_id: string
          recurring_reminders?: boolean
          updated_at?: string
          weekly_summary?: boolean
        }
        Update: {
          budget_alerts?: boolean
          card_statement_due?: boolean
          created_at?: string
          household_id?: string
          household_joined?: boolean
          id?: string
          insights?: boolean
          profile_id?: string
          recurring_reminders?: boolean
          updated_at?: string
          weekly_summary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payees: {
        Row: {
          aliases: string[] | null
          client_rev: number
          default_account_id: string | null
          default_category_id: string | null
          household_id: string
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          aliases?: string[] | null
          client_rev?: number
          default_account_id?: string | null
          default_category_id?: string | null
          household_id: string
          id: string
          logo_url?: string | null
          name: string
        }
        Update: {
          aliases?: string[] | null
          client_rev?: number
          default_account_id?: string | null
          default_category_id?: string | null
          household_id?: string
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "payees_default_account_id_fkey"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payees_default_category_id_fkey"
            columns: ["default_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payees_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_snapshots: {
        Row: {
          as_of: string
          cash_flow: number
          cost_basis: number
          market_value: number
          portfolio_id: string
        }
        Insert: {
          as_of: string
          cash_flow?: number
          cost_basis: number
          market_value: number
          portfolio_id: string
        }
        Update: {
          as_of?: string
          cash_flow?: number
          cost_basis?: number
          market_value?: number
          portfolio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_snapshots_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          base_currency: string
          broker_account_id: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          household_id: string
          id: string
          name: string
          updated_at: string
          visibility: string
        }
        Insert: {
          base_currency: string
          broker_account_id?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          household_id: string
          id: string
          name: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          base_currency?: string
          broker_account_id?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          household_id?: string
          id?: string
          name?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "portfolios_broker_account_id_fkey"
            columns: ["broker_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolios_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      price_index: {
        Row: {
          currency_code: string
          id: string
          index_value: number
          period: string
          source: string
        }
        Insert: {
          currency_code: string
          id: string
          index_value: number
          period: string
          source?: string
        }
        Update: {
          currency_code?: string
          id?: string
          index_value?: number
          period?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_index_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      price_snapshots: {
        Row: {
          as_of: string
          close: number
          currency_code: string
          high: number | null
          instrument_id: string
          low: number | null
          open: number | null
          provider: string
          volume: number | null
        }
        Insert: {
          as_of: string
          close: number
          currency_code: string
          high?: number | null
          instrument_id: string
          low?: number | null
          open?: number | null
          provider: string
          volume?: number | null
        }
        Update: {
          as_of?: string
          close?: number
          currency_code?: string
          high?: number | null
          instrument_id?: string
          low?: number | null
          open?: number | null
          provider?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_snapshots_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "price_snapshots_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_notification_preferences: {
        Row: {
          app_updates: boolean
          created_at: string
          invite_received: boolean
          profile_id: string
          updated_at: string
        }
        Insert: {
          app_updates?: boolean
          created_at?: string
          invite_received?: boolean
          profile_id: string
          updated_at?: string
        }
        Update: {
          app_updates?: boolean
          created_at?: string
          invite_received?: boolean
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_requested_at: string
          access_reviewed_at: string | null
          access_reviewed_by: string | null
          access_status: string
          avatar_url: string | null
          birth_date: string | null
          country: string | null
          default_household_id: string | null
          display_name: string | null
          icon: string
          id: string
          is_app_admin: boolean
          last_seen_at: string | null
          locale: string
          settings: Json
          timezone: string | null
        }
        Insert: {
          access_requested_at?: string
          access_reviewed_at?: string | null
          access_reviewed_by?: string | null
          access_status?: string
          avatar_url?: string | null
          birth_date?: string | null
          country?: string | null
          default_household_id?: string | null
          display_name?: string | null
          icon?: string
          id: string
          is_app_admin?: boolean
          last_seen_at?: string | null
          locale?: string
          settings?: Json
          timezone?: string | null
        }
        Update: {
          access_requested_at?: string
          access_reviewed_at?: string | null
          access_reviewed_by?: string | null
          access_status?: string
          avatar_url?: string | null
          birth_date?: string | null
          country?: string | null
          default_household_id?: string | null
          display_name?: string | null
          icon?: string
          id?: string
          is_app_admin?: boolean
          last_seen_at?: string | null
          locale?: string
          settings?: Json
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_access_reviewed_by_fkey"
            columns: ["access_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_household_fkey"
            columns: ["default_household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          account_id: string
          anchor_date: string
          archived_at: string | null
          auto_post: boolean
          category_id: string | null
          client_rev: number
          created_at: string
          created_by: string
          currency_code: string
          day_of_month: number | null
          detected: boolean
          end_date: string | null
          expected_amount: number
          fallback_account_id: string | null
          frequency: string
          household_id: string
          id: string
          kind: string
          last_materialized_on: string | null
          name: string
          updated_at: string
        }
        Insert: {
          account_id: string
          anchor_date: string
          archived_at?: string | null
          auto_post?: boolean
          category_id?: string | null
          client_rev?: number
          created_at?: string
          created_by: string
          currency_code: string
          day_of_month?: number | null
          detected?: boolean
          end_date?: string | null
          expected_amount: number
          fallback_account_id?: string | null
          frequency?: string
          household_id: string
          id: string
          kind: string
          last_materialized_on?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          anchor_date?: string
          archived_at?: string | null
          auto_post?: boolean
          category_id?: string | null
          client_rev?: number
          created_at?: string
          created_by?: string
          currency_code?: string
          day_of_month?: number | null
          detected?: boolean
          end_date?: string | null
          expected_amount?: number
          fallback_account_id?: string | null
          frequency?: string
          household_id?: string
          id?: string
          kind?: string
          last_materialized_on?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "recurring_rules_fallback_account_id_fkey"
            columns: ["fallback_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          actions: Json
          client_rev: number
          created_at: string
          created_by: string
          deleted_at: string | null
          hit_count: number
          household_id: string
          id: string
          is_active: boolean
          match: Json
          name: string
          priority: number
          updated_at: string
        }
        Insert: {
          actions: Json
          client_rev?: number
          created_at?: string
          created_by: string
          deleted_at?: string | null
          hit_count?: number
          household_id: string
          id: string
          is_active?: boolean
          match: Json
          name: string
          priority?: number
          updated_at?: string
        }
        Update: {
          actions?: Json
          client_rev?: number
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          hit_count?: number
          household_id?: string
          id?: string
          is_active?: boolean
          match?: Json
          name?: string
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          amount: number
          amount_base: number | null
          created_at: string
          created_by: string
          currency_code: string
          deleted_at: string | null
          from_member: string
          fx_rate: number | null
          fx_source: string
          household_id: string
          id: string
          method: string | null
          settled_at: string | null
          status: string
          to_member: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          amount_base?: number | null
          created_at?: string
          created_by: string
          currency_code: string
          deleted_at?: string | null
          from_member: string
          fx_rate?: number | null
          fx_source?: string
          household_id: string
          id: string
          method?: string | null
          settled_at?: string | null
          status?: string
          to_member: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_base?: number | null
          created_at?: string
          created_by?: string
          currency_code?: string
          deleted_at?: string | null
          from_member?: string
          fx_rate?: number | null
          fx_source?: string
          household_id?: string
          id?: string
          method?: string | null
          settled_at?: string | null
          status?: string
          to_member?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "settlements_from_member_fkey"
            columns: ["from_member"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_to_member_fkey"
            columns: ["to_member"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          client_rev: number
          color: string | null
          household_id: string
          id: string
          name: string
        }
        Insert: {
          client_rev?: number
          color?: string | null
          household_id: string
          id: string
          name: string
        }
        Update: {
          client_rev?: number
          color?: string | null
          household_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      target_allocations: {
        Row: {
          band_pct: number
          dimension: string
          id: string
          key: string
          portfolio_id: string
          target_pct: number
        }
        Insert: {
          band_pct?: number
          dimension: string
          id: string
          key: string
          portfolio_id: string
          target_pct: number
        }
        Update: {
          band_pct?: number
          dimension?: string
          id?: string
          key?: string
          portfolio_id?: string
          target_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "target_allocations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          amount_base: number | null
          created_at: string
          created_by: string
          currency_code: string
          deleted_at: string | null
          executed_at: string
          fees: number
          fx_rate: number | null
          fx_resolved_at: string | null
          fx_source: string
          gross_amount: number
          id: string
          instrument_id: string
          kind: string
          net_amount: number
          note: string | null
          portfolio_id: string
          price: number
          quantity: number
          settlement_account_id: string | null
          taxes: number
        }
        Insert: {
          amount_base?: number | null
          created_at?: string
          created_by: string
          currency_code: string
          deleted_at?: string | null
          executed_at: string
          fees?: number
          fx_rate?: number | null
          fx_resolved_at?: string | null
          fx_source?: string
          gross_amount: number
          id: string
          instrument_id: string
          kind: string
          net_amount: number
          note?: string | null
          portfolio_id: string
          price: number
          quantity: number
          settlement_account_id?: string | null
          taxes?: number
        }
        Update: {
          amount_base?: number | null
          created_at?: string
          created_by?: string
          currency_code?: string
          deleted_at?: string | null
          executed_at?: string
          fees?: number
          fx_rate?: number | null
          fx_resolved_at?: string | null
          fx_source?: string
          gross_amount?: number
          id?: string
          instrument_id?: string
          kind?: string
          net_amount?: number
          note?: string | null
          portfolio_id?: string
          price?: number
          quantity?: number
          settlement_account_id?: string | null
          taxes?: number
        }
        Relationships: [
          {
            foreignKeyName: "trades_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "trades_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_settlement_account_id_fkey"
            columns: ["settlement_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_shares: {
        Row: {
          deleted_at: string | null
          fx_source: string
          id: string
          member_id: string
          settled_at: string | null
          settlement_id: string | null
          share_amount: number
          share_amount_base: number | null
          share_pct: number | null
          split_mode: string | null
          transaction_id: string
        }
        Insert: {
          deleted_at?: string | null
          fx_source?: string
          id: string
          member_id: string
          settled_at?: string | null
          settlement_id?: string | null
          share_amount: number
          share_amount_base?: number | null
          share_pct?: number | null
          split_mode?: string | null
          transaction_id: string
        }
        Update: {
          deleted_at?: string | null
          fx_source?: string
          id?: string
          member_id?: string
          settled_at?: string | null
          settlement_id?: string | null
          share_amount?: number
          share_amount_base?: number | null
          share_pct?: number | null
          split_mode?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_shares_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_shares_settlement_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_shares_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_splits: {
        Row: {
          amount: number
          amount_base: number | null
          category_id: string | null
          deleted_at: string | null
          fx_source: string
          id: string
          note: string | null
          transaction_id: string
        }
        Insert: {
          amount: number
          amount_base?: number | null
          category_id?: string | null
          deleted_at?: string | null
          fx_source?: string
          id: string
          note?: string | null
          transaction_id: string
        }
        Update: {
          amount?: number
          amount_base?: number | null
          category_id?: string | null
          deleted_at?: string | null
          fx_source?: string
          id?: string
          note?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_splits_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_tags: {
        Row: {
          tag_id: string
          transaction_id: string
        }
        Insert: {
          tag_id: string
          transaction_id: string
        }
        Update: {
          tag_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_tags_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          amount_base: number | null
          attachments: Json
          category_id: string | null
          client_rev: number
          counter_account_id: string | null
          counter_amount: number | null
          counter_currency_code: string | null
          counter_fx_rate: number | null
          created_at: string
          created_by: string
          currency_code: string
          deleted_at: string | null
          fx_provider: string | null
          fx_quote_kind: string | null
          fx_rate: number | null
          fx_resolved_at: string | null
          fx_source: string
          household_id: string
          id: string
          installment_group_id: string | null
          installment_number: number | null
          installment_total: number | null
          kind: string
          location: Json | null
          needs_capture_fx: boolean | null
          note: string | null
          occurred_at: string
          original_amount: number | null
          original_currency: string | null
          original_rate: number | null
          payee_id: string | null
          recurring_id: string | null
          recurring_occurrence_date: string | null
          source: string
          status: string
          sync_error: string | null
          sync_state: string
          trade_id: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          account_id: string
          amount: number
          amount_base?: number | null
          attachments?: Json
          category_id?: string | null
          client_rev?: number
          counter_account_id?: string | null
          counter_amount?: number | null
          counter_currency_code?: string | null
          counter_fx_rate?: number | null
          created_at?: string
          created_by: string
          currency_code: string
          deleted_at?: string | null
          fx_provider?: string | null
          fx_quote_kind?: string | null
          fx_rate?: number | null
          fx_resolved_at?: string | null
          fx_source?: string
          household_id: string
          id: string
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          kind: string
          location?: Json | null
          needs_capture_fx?: boolean | null
          note?: string | null
          occurred_at: string
          original_amount?: number | null
          original_currency?: string | null
          original_rate?: number | null
          payee_id?: string | null
          recurring_id?: string | null
          recurring_occurrence_date?: string | null
          source?: string
          status?: string
          sync_error?: string | null
          sync_state?: string
          trade_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          account_id?: string
          amount?: number
          amount_base?: number | null
          attachments?: Json
          category_id?: string | null
          client_rev?: number
          counter_account_id?: string | null
          counter_amount?: number | null
          counter_currency_code?: string | null
          counter_fx_rate?: number | null
          created_at?: string
          created_by?: string
          currency_code?: string
          deleted_at?: string | null
          fx_provider?: string | null
          fx_quote_kind?: string | null
          fx_rate?: number | null
          fx_resolved_at?: string | null
          fx_source?: string
          household_id?: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          kind?: string
          location?: Json | null
          needs_capture_fx?: boolean | null
          note?: string | null
          occurred_at?: string
          original_amount?: number | null
          original_currency?: string | null
          original_rate?: number | null
          payee_id?: string | null
          recurring_id?: string | null
          recurring_occurrence_date?: string | null
          source?: string
          status?: string
          sync_error?: string | null
          sync_state?: string
          trade_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_counter_account_id_fkey"
            columns: ["counter_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_counter_currency_code_fkey"
            columns: ["counter_currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_original_currency_fkey"
            columns: ["original_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "payees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      visibility_grants: {
        Row: {
          granted_at: string
          granted_by: string
          household_id: string
          id: string
          member_id: string
          revoked_at: string | null
          subject_id: string
          subject_type: string
        }
        Insert: {
          granted_at?: string
          granted_by: string
          household_id: string
          id: string
          member_id: string
          revoked_at?: string | null
          subject_id: string
          subject_type: string
        }
        Update: {
          granted_at?: string
          granted_by?: string
          household_id?: string
          id?: string
          member_id?: string
          revoked_at?: string | null
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "visibility_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visibility_grants_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visibility_grants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { invite_code: string }; Returns: string }
      add_currency: {
        Args: {
          p_code: string
          p_decimals: number
          p_kind: string
          p_name: string
          p_symbol: string
        }
        Returns: {
          code: string
          decimals: number
          is_active: boolean
          kind: string
          name: string
          symbol: string
        }
        SetofOptions: {
          from: "*"
          to: "currencies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_access_requests: {
        Args: never
        Returns: {
          access_requested_at: string
          access_status: string
          country: string
          display_name: string
          email: string
          is_app_admin: boolean
          last_seen_at: string
          profile_id: string
        }[]
      }
      admin_metrics: { Args: never; Returns: Json }
      admin_set_access_status: {
        Args: { new_status: string; target_id: string }
        Returns: undefined
      }
      assert_can_mirror: {
        Args: { p_household_id: string; p_target_member: string }
        Returns: undefined
      }
      can_see: {
        Args: {
          p_id: string
          p_owner: string
          p_type: string
          p_visibility: string
        }
        Returns: boolean
      }
      can_see_as: {
        Args: {
          p_id: string
          p_owner: string
          p_type: string
          p_viewer: string
          p_visibility: string
        }
        Returns: boolean
      }
      can_write: { Args: { h: string }; Returns: boolean }
      card_statement_cycle: {
        Args: { p_due_day: number; p_ref: string; p_statement_day: number }
        Returns: {
          closing_date: string
          due_date: string
          period_end: string
          period_start: string
        }[]
      }
      change_household_base_currency: {
        Args: { p_household_id: string; p_new_base_currency: string }
        Returns: Json
      }
      check_move_accounts_preconditions: {
        Args: { p_account_ids: string[]; p_target_household_id: string }
        Returns: string
      }
      clamped_date: {
        Args: { p_day: number; p_month: number; p_year: number }
        Returns: string
      }
      close_overdue_card_statements: { Args: never; Returns: undefined }
      compute_fx_monthly_averages: { Args: never; Returns: undefined }
      current_households: { Args: never; Returns: string[] }
      dispatch_due_notifications: { Args: never; Returns: undefined }
      household_created_by_caller: { Args: { h: string }; Returns: boolean }
      is_app_admin: { Args: never; Returns: boolean }
      is_household_admin: { Args: { h: string }; Returns: boolean }
      is_household_owner: { Args: { h: string }; Returns: boolean }
      materialize_recurring_transactions: { Args: never; Returns: undefined }
      mirror_accounts: {
        Args: { p_household_id: string; p_target_member: string }
        Returns: {
          currency_code: string
          current_balance: string
          id: string
          kind: string
          name: string
        }[]
      }
      mirror_transactions: {
        Args: { p_household_id: string; p_target_member: string }
        Returns: {
          account_id: string
          amount: string
          counter_account_id: string
          currency_code: string
          id: string
          kind: string
          note: string
          occurred_at: string
        }[]
      }
      move_accounts_to_household: {
        Args: { p_account_ids: string[]; p_target_household_id: string }
        Returns: Json
      }
      open_card_statements: { Args: never; Returns: undefined }
      preflight_change_base_currency: {
        Args: { p_household_id: string; p_new_base_currency: string }
        Returns: Json
      }
      preflight_move_accounts: {
        Args: { p_account_ids: string[]; p_target_household_id: string }
        Returns: Json
      }
      prune_push_subscriptions: { Args: never; Returns: undefined }
      purge_audit_log: { Args: never; Returns: undefined }
      purge_household_step: {
        Args: { p_household_id: string; p_step: string }
        Returns: number
      }
      recompute_account_balance: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      recurring_occurrences_between: {
        Args: {
          p_anchor: string
          p_day_of_month: number
          p_frequency: string
          p_from: string
          p_to: string
        }
        Returns: string[]
      }
      trigger_daily_fx_sync: { Args: never; Returns: undefined }
      trigger_daily_inflation_sync: { Args: never; Returns: undefined }
      trigger_daily_price_sync: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
