import { createClient } from "../supabase/client";
import { newId } from "./ids";

export interface AssetClass {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number | null;
  /** `null` = plantilla global sembrada; nunca se edita ni se borra directo, se clona (Patrón C). */
  householdId: string | null;
}

export interface AmortizationStep {
  date: string; // ISO
  principalPct: number; // 0-100, % del nominal que amortiza en esa fecha
}

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  assetClassId: string | null;
  currencyCode: string;
  quantityDecimals: number | null;
  /** Renta fija (I11) — `null` si no aplica (acciones, CEDEARs, crypto, etc). */
  maturityDate: string | null;
  couponRate: number | null; // % anual, ej. 8.5
  couponFrequency: number | null; // pagos por año: 1, 2, 4, 12
  amortizationSchedule: AmortizationStep[] | null;
}

/**
 * Bloque I — instrumentos/clases de activo son Patrón C (catálogo global +
 * clonado por household). Viven solo en Supabase, como el resto del
 * catálogo de referencia (`institutions`, `currencies`) — no se
 * duplicaron en Dexie para esta primera versión del módulo (ver la nota
 * de arquitectura en `portfolios-repo.ts`).
 */
export const instrumentsRepo = {
  async listAssetClasses(): Promise<AssetClass[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from("asset_classes").select("id, name, icon, color, sort_order, household_id").order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({ id: row.id, name: row.name, icon: row.icon, color: row.color, sortOrder: row.sort_order, householdId: row.household_id }));
  },

  /** I8 — clona una clase global al editarla por primera vez (copy-on-write, nunca se muta la plantilla). */
  async cloneForEdit(source: AssetClass, householdId: string, patch: Partial<Pick<AssetClass, "name" | "icon" | "color">>): Promise<AssetClass> {
    const supabase = createClient();
    const row = {
      id: newId(),
      household_id: householdId,
      name: patch.name ?? source.name,
      icon: patch.icon ?? source.icon,
      color: patch.color ?? source.color,
      sort_order: source.sortOrder,
      source_id: source.id,
    };
    const { error } = await supabase.from("asset_classes").insert(row as never);
    if (error) throw error;
    return { id: row.id, name: row.name, icon: row.icon, color: row.color, sortOrder: row.sort_order, householdId };
  },

  /** Edita una clase ya propia del household (no la plantilla global). */
  async updateOwn(id: string, patch: Partial<Pick<AssetClass, "name" | "icon" | "color">>): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("asset_classes").update({ name: patch.name, icon: patch.icon, color: patch.color } as never).eq("id", id);
    if (error) throw error;
  },

  async createCustom(householdId: string, name: string, sortOrder: number): Promise<AssetClass> {
    const supabase = createClient();
    const row = { id: newId(), household_id: householdId, name, icon: null, color: null, sort_order: sortOrder, source_id: null };
    const { error } = await supabase.from("asset_classes").insert(row as never);
    if (error) throw error;
    return { id: row.id, name: row.name, icon: null, color: null, sortOrder: row.sort_order, householdId };
  },

  async deleteOwn(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("asset_classes").delete().eq("id", id);
    if (error) throw error;
  },

  async reorder(items: readonly { id: string; sortOrder: number }[]): Promise<void> {
    const supabase = createClient();
    await Promise.all(items.map((item) => supabase.from("asset_classes").update({ sort_order: item.sortOrder } as never).eq("id", item.id)));
  },

  async listForHousehold(householdId: string): Promise<Instrument[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("instruments")
      .select("id, symbol, name, asset_class_id, currency_code, metadata, maturity_date, coupon_rate, coupon_frequency, amortization_schedule")
      .or(`household_id.is.null,household_id.eq.${householdId}`)
      .order("symbol", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      assetClassId: row.asset_class_id,
      currencyCode: row.currency_code,
      quantityDecimals: (row.metadata as { quantityDecimals?: number } | null)?.quantityDecimals ?? null,
      maturityDate: row.maturity_date,
      couponRate: row.coupon_rate,
      couponFrequency: row.coupon_frequency,
      amortizationSchedule: (row.amortization_schedule as unknown as AmortizationStep[] | null) ?? null,
    }));
  },

  /** I7b — crear instrumento a mano, siempre clonado al household (nunca se escribe una fila global desde el cliente). */
  async create(input: {
    householdId: string;
    symbol: string;
    name: string;
    assetClassId: string | null;
    currencyCode: string;
    createdBy: string;
    maturityDate?: string | null;
    couponRate?: number | null;
    couponFrequency?: number | null;
  }): Promise<Instrument> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("instruments")
      .insert({
        id: crypto.randomUUID(),
        household_id: input.householdId,
        symbol: input.symbol.toUpperCase(),
        name: input.name,
        asset_class_id: input.assetClassId,
        currency_code: input.currencyCode,
        is_manual: true,
        maturity_date: input.maturityDate ?? null,
        coupon_rate: input.couponRate ?? null,
        coupon_frequency: input.couponFrequency ?? null,
      } as never)
      .select("id, symbol, name, asset_class_id, currency_code, maturity_date, coupon_rate, coupon_frequency")
      .single<{ id: string; symbol: string; name: string; asset_class_id: string | null; currency_code: string; maturity_date: string | null; coupon_rate: number | null; coupon_frequency: number | null }>();
    if (error) throw error;
    return {
      id: data.id,
      symbol: data.symbol,
      name: data.name,
      assetClassId: data.asset_class_id,
      currencyCode: data.currency_code,
      quantityDecimals: null,
      maturityDate: data.maturity_date,
      couponRate: data.coupon_rate,
      couponFrequency: data.coupon_frequency,
      amortizationSchedule: null,
    };
  },
};
