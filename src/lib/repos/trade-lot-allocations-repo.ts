import { createClient } from "../supabase/client";
import type { ExplicitAllocations } from "../analytics/lots";

export interface TradeLotAllocation {
  sellTradeId: string;
  buyTradeId: string;
  quantity: number;
}

interface TradeLotAllocationRow {
  sell_trade_id: string;
  buy_trade_id: string;
  quantity: number;
}

const SELECT_COLUMNS = "sell_trade_id, buy_trade_id, quantity";

export const tradeLotAllocationsRepo = {
  /**
   * `computeLots()` toma un `ExplicitAllocations` (Map por `sellTradeId`),
   * no una lista plana — arma el shape acá para que el caller (`trades/new`,
   * `InstrumentDetailContent`) no tenga que reagrupar.
   */
  async listForPortfolio(sellTradeIds: readonly string[]): Promise<ExplicitAllocations> {
    if (sellTradeIds.length === 0) return new Map();
    const supabase = createClient();
    const { data, error } = await supabase.from("trade_lot_allocations").select(SELECT_COLUMNS).in("sell_trade_id", sellTradeIds).is("deleted_at", null).returns<TradeLotAllocationRow[]>();
    if (error) throw error;
    const byTrade = new Map<string, { buyTradeId: string; quantity: number }[]>();
    for (const row of data ?? []) {
      const list = byTrade.get(row.sell_trade_id) ?? [];
      if (!byTrade.has(row.sell_trade_id)) byTrade.set(row.sell_trade_id, list);
      list.push({ buyTradeId: row.buy_trade_id, quantity: row.quantity });
    }
    return byTrade;
  },

  /**
   * Reemplaza TODAS las allocations de una venta — se soft-borran las
   * viejas (si las hubiera, p. ej. al reeditar la venta) e insertan las
   * nuevas, nunca un merge parcial: la elección de lotes de una venta es
   * un todo, no un acumulado.
   */
  async replaceForSell(sellTradeId: string, allocations: readonly { buyTradeId: string; quantity: number }[]): Promise<void> {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("trade_lot_allocations")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("sell_trade_id", sellTradeId)
      .is("deleted_at", null);
    if (deleteError) throw deleteError;
    if (allocations.length === 0) return;
    const { error: insertError } = await supabase.from("trade_lot_allocations").insert(
      allocations.map((a) => ({
        id: crypto.randomUUID(),
        sell_trade_id: sellTradeId,
        buy_trade_id: a.buyTradeId,
        quantity: a.quantity,
      })) as never
    );
    if (insertError) throw insertError;
  },
};
