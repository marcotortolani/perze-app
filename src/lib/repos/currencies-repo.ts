import { createClient } from "../supabase/client";
import type { CurrencyRow } from "../db/schema";

export interface NewCurrencyInput {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  kind: "fiat" | "crypto";
}

/**
 * `currencies` es Patrón C puro (`01-arquitectura-datos.md` § 3): catálogo
 * global, sin `household_id`, así que no vive en Dexie con el resto de las
 * entidades del household — se lee directo de Supabase, con `staleTime:
 * Infinity` en el hook (`use-currencies.ts`) porque cambia rarísima vez.
 * `add()` pasa por la RPC `add_currency` (SECURITY DEFINER), nunca un
 * INSERT directo — es la excepción documentada en
 * `20260806080000_add_currency_rpc.sql`, no un agujero en RLS.
 */
export const currenciesRepo = {
  async list(): Promise<CurrencyRow[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from("currencies").select("code, name, symbol, decimals, kind, is_active").eq("is_active", true).order("code");
    if (error) throw error;
    return (data ?? []).map((row) => ({
      code: row.code,
      name: row.name,
      symbol: row.symbol,
      decimals: row.decimals,
      kind: row.kind as CurrencyRow["kind"],
      isActive: row.is_active,
    }));
  },

  async add(input: NewCurrencyInput): Promise<CurrencyRow> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("add_currency", {
      p_code: input.code,
      p_name: input.name,
      p_symbol: input.symbol,
      p_decimals: input.decimals,
      p_kind: input.kind,
    });
    if (error) throw error;
    return {
      code: data.code,
      name: data.name,
      symbol: data.symbol,
      decimals: data.decimals,
      kind: data.kind as CurrencyRow["kind"],
      isActive: data.is_active,
    };
  },
};
