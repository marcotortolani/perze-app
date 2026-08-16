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
  /** `'low' | 'medium' | 'high' | null` — dimensión `risk` del rebalanceo de cartera agrupa por acá, nunca se calcula en la pantalla. */
  defaultRisk: string | null;
}

export interface AmortizationStep {
  date: string; // ISO
  principalPct: number; // 0-100, % del nominal que amortiza en esa fecha
}

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  /** `null` = catálogo global (Patrón C) — nunca se borra desde acá; solo un clonado propio del household puede eliminarse (`deleteUnused`). */
  householdId: string | null;
  assetClassId: string | null;
  currencyCode: string;
  quantityDecimals: number | null;
  /** Renta fija (I11) — `null` si no aplica (acciones, CEDEARs, crypto, etc). */
  maturityDate: string | null;
  couponRate: number | null; // % anual, ej. 8.5
  couponFrequency: number | null; // pagos por año: 1, 2, 4, 12
  amortizationSchedule: AmortizationStep[] | null;
  /** `null` = sin cobertura automática (I12: el precio se carga a mano). */
  priceProvider: string | null;
  providerSymbol: string | null;
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
    const { data, error } = await supabase.from("asset_classes").select("id, name, icon, color, sort_order, household_id, default_risk").order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({ id: row.id, name: row.name, icon: row.icon, color: row.color, sortOrder: row.sort_order, householdId: row.household_id, defaultRisk: row.default_risk }));
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
      default_risk: source.defaultRisk,
    };
    const { error } = await supabase.from("asset_classes").insert(row as never);
    if (error) throw error;
    return { id: row.id, name: row.name, icon: row.icon, color: row.color, sortOrder: row.sort_order, householdId, defaultRisk: row.default_risk };
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
    return { id: row.id, name: row.name, icon: null, color: null, sortOrder: row.sort_order, householdId, defaultRisk: null };
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
      .select("id, symbol, name, household_id, asset_class_id, currency_code, metadata, maturity_date, coupon_rate, coupon_frequency, amortization_schedule, price_provider, provider_symbol")
      .or(`household_id.is.null,household_id.eq.${householdId}`)
      .order("symbol", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      householdId: row.household_id,
      assetClassId: row.asset_class_id,
      currencyCode: row.currency_code,
      quantityDecimals: (row.metadata as { quantityDecimals?: number } | null)?.quantityDecimals ?? null,
      priceProvider: row.price_provider,
      providerSymbol: row.provider_symbol,
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
    /** `null`/`undefined` = sin cobertura automática, el precio se carga a mano (I12) — el camino de primera clase, no un fallback. */
    priceProvider?: string | null;
    providerSymbol?: string | null;
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
        price_provider: input.priceProvider ?? null,
        provider_symbol: input.providerSymbol ?? null,
      } as never)
      .select("id, symbol, name, asset_class_id, currency_code, maturity_date, coupon_rate, coupon_frequency, price_provider, provider_symbol")
      .single<{ id: string; symbol: string; name: string; asset_class_id: string | null; currency_code: string; maturity_date: string | null; coupon_rate: number | null; coupon_frequency: number | null; price_provider: string | null; provider_symbol: string | null }>();
    if (error) throw error;
    return {
      id: data.id,
      symbol: data.symbol,
      name: data.name,
      householdId: input.householdId,
      assetClassId: data.asset_class_id,
      currencyCode: data.currency_code,
      quantityDecimals: null,
      priceProvider: data.price_provider,
      providerSymbol: data.provider_symbol,
      maturityDate: data.maturity_date,
      couponRate: data.coupon_rate,
      couponFrequency: data.coupon_frequency,
      amortizationSchedule: null,
    };
  },

  /**
   * I12 — sacar un instrumento de la lista de seguimiento. Solo tiene
   * sentido (y solo lo ofrece la UI) para uno propio del household: uno
   * del catálogo global no es tuyo para borrar.
   *
   * D72 — `trades` no tiene política RLS de `DELETE` (solo soft-delete vía
   * `deleted_at`), así que sus filas nunca desaparecen de verdad del lado
   * del cliente. La FK `trades.instrument_id` sigue viéndolas aunque estén
   * soft-deleted, y borrar el instrumento tirando 409 (antes sin capturar,
   * lo que además dejaba el `router.back()` del caller sin ejecutarse y el
   * panel de detalle abierto mostrando la posición ya vaciada). Este 409
   * puntual (código Postgres `23503`, violación de FK) se traga a
   * propósito: el instrumento queda en el catálogo del household en vez de
   * desaparecer, que es el trade-off correcto — su historial de
   * operaciones (soft-deleted) sigue existiendo y necesita algo a lo que
   * apuntar. Cualquier otro error sí se propaga.
   */
  async deleteUnused(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("instruments").delete().eq("id", id);
    if (error && error.code !== "23503") throw error;
  },
};
