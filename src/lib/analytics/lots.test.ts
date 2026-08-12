import { describe, expect, it } from "vitest";
import { computeLots } from "./lots";

describe("computeLots", () => {
  it("una compra abre un lote con su propio precio y costo", () => {
    const { lotsByInstrument } = computeLots([{ id: "1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" }]);
    const lots = lotsByInstrument.get("AAPL")!;
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({ buyTradeId: "1", originalQuantity: 10, remainingQuantity: 10, unitPrice: 100, costBasisRemaining: 1000n });
  });

  it("una venta consume FIFO — el lote más viejo primero", () => {
    const trades = [
      { id: "buy1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "buy2", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 150, netAmount: 1500n, executedAt: "2026-02-01T00:00:00Z" },
      { id: "sell1", instrumentId: "AAPL", kind: "sell", quantity: 5, price: 200, netAmount: 1000n, executedAt: "2026-03-01T00:00:00Z" },
    ];
    const { lotsByInstrument, allocationsBySellTradeId } = computeLots(trades);
    const lots = lotsByInstrument.get("AAPL")!;
    // El lote de enero (más viejo) pierde 5 de sus 10 — el de febrero queda intacto.
    expect(lots[0]).toMatchObject({ buyTradeId: "buy1", remainingQuantity: 5, costBasisRemaining: 500n });
    expect(lots[1]).toMatchObject({ buyTradeId: "buy2", remainingQuantity: 10, costBasisRemaining: 1500n });
    expect(allocationsBySellTradeId.get("sell1")).toEqual([{ buyTradeId: "buy1", quantity: 5 }]);
  });

  it("una venta que cruza dos lotes se reparte entre los dos, en orden FIFO", () => {
    const trades = [
      { id: "buy1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "buy2", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 150, netAmount: 1500n, executedAt: "2026-02-01T00:00:00Z" },
      { id: "sell1", instrumentId: "AAPL", kind: "sell", quantity: 15, price: 200, netAmount: 3000n, executedAt: "2026-03-01T00:00:00Z" },
    ];
    const { lotsByInstrument, allocationsBySellTradeId } = computeLots(trades);
    const lots = lotsByInstrument.get("AAPL")!;
    expect(lots[0]).toMatchObject({ buyTradeId: "buy1", remainingQuantity: 0, costBasisRemaining: 0n });
    expect(lots[1]).toMatchObject({ buyTradeId: "buy2", remainingQuantity: 5, costBasisRemaining: 750n });
    expect(allocationsBySellTradeId.get("sell1")).toEqual([
      { buyTradeId: "buy1", quantity: 10 },
      { buyTradeId: "buy2", quantity: 5 },
    ]);
  });

  it("una venta total deja el lote en cero, no negativo", () => {
    const trades = [
      { id: "buy1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "sell1", instrumentId: "AAPL", kind: "sell", quantity: 10, price: 120, netAmount: 1200n, executedAt: "2026-02-01T00:00:00Z" },
    ];
    const { lotsByInstrument } = computeLots(trades);
    expect(lotsByInstrument.get("AAPL")![0]).toMatchObject({ remainingQuantity: 0, costBasisRemaining: 0n });
  });

  it("transfer_in abre un lote igual que una compra, transfer_out consume FIFO igual que una venta", () => {
    const trades = [
      { id: "1", instrumentId: "SPCX", kind: "transfer_in", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "2", instrumentId: "SPCX", kind: "transfer_out", quantity: 4, price: 0, netAmount: 0n, executedAt: "2026-02-01T00:00:00Z" },
    ];
    const { lotsByInstrument, allocationsBySellTradeId } = computeLots(trades);
    expect(lotsByInstrument.get("SPCX")![0]).toMatchObject({ remainingQuantity: 6, costBasisRemaining: 600n });
    expect(allocationsBySellTradeId.get("2")).toEqual([{ buyTradeId: "1", quantity: 4 }]);
  });

  it("dividendos, cupones y comisiones no abren ni consumen lotes", () => {
    const trades = [
      { id: "1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "2", instrumentId: "AAPL", kind: "dividend", quantity: 0, price: 0, netAmount: 50n, executedAt: "2026-02-01T00:00:00Z" },
      { id: "3", instrumentId: "AAPL", kind: "fee", quantity: 0, price: 0, netAmount: -10n, executedAt: "2026-03-01T00:00:00Z" },
    ];
    const { lotsByInstrument } = computeLots(trades);
    const lots = lotsByInstrument.get("AAPL")!;
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({ remainingQuantity: 10, costBasisRemaining: 1000n });
  });

  it("da el mismo resultado sin importar el orden de entrada", () => {
    const ascending = [
      { id: "buy1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "sell1", instrumentId: "AAPL", kind: "sell", quantity: 5, price: 200, netAmount: 1000n, executedAt: "2026-02-01T00:00:00Z" },
    ];
    const descending = [...ascending].reverse();
    const a = computeLots(ascending);
    const b = computeLots(descending);
    expect(b.lotsByInstrument.get("AAPL")).toEqual(a.lotsByInstrument.get("AAPL"));
    expect(b.allocationsBySellTradeId.get("sell1")).toEqual(a.allocationsBySellTradeId.get("sell1"));
  });

  it("una allocation explícita elige un lote distinto al FIFO por defecto", () => {
    const trades = [
      { id: "buy1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "buy2", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 150, netAmount: 1500n, executedAt: "2026-02-01T00:00:00Z" },
      { id: "sell1", instrumentId: "AAPL", kind: "sell", quantity: 5, price: 200, netAmount: 1000n, executedAt: "2026-03-01T00:00:00Z" },
    ];
    // Sin allocation, FIFO consumiría del lote de enero (buy1). Con
    // allocation explícita a buy2, el de enero queda intacto.
    const explicit = new Map([["sell1", [{ buyTradeId: "buy2", quantity: 5 }]]]);
    const { lotsByInstrument, allocationsBySellTradeId } = computeLots(trades, explicit);
    const lots = lotsByInstrument.get("AAPL")!;
    expect(lots[0]).toMatchObject({ buyTradeId: "buy1", remainingQuantity: 10, costBasisRemaining: 1000n });
    expect(lots[1]).toMatchObject({ buyTradeId: "buy2", remainingQuantity: 5, costBasisRemaining: 750n });
    expect(allocationsBySellTradeId.get("sell1")).toEqual([{ buyTradeId: "buy2", quantity: 5 }]);
  });

  it("una allocation explícita parcial cae a FIFO para el resto", () => {
    const trades = [
      { id: "buy1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "buy2", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 150, netAmount: 1500n, executedAt: "2026-02-01T00:00:00Z" },
      { id: "sell1", instrumentId: "AAPL", kind: "sell", quantity: 8, price: 200, netAmount: 1600n, executedAt: "2026-03-01T00:00:00Z" },
    ];
    // Elige 3 de buy2 explícito; los 5 restantes caen a FIFO → buy1.
    const explicit = new Map([["sell1", [{ buyTradeId: "buy2", quantity: 3 }]]]);
    const { lotsByInstrument, allocationsBySellTradeId } = computeLots(trades, explicit);
    const lots = lotsByInstrument.get("AAPL")!;
    expect(lots[0]).toMatchObject({ buyTradeId: "buy1", remainingQuantity: 5, costBasisRemaining: 500n });
    expect(lots[1]).toMatchObject({ buyTradeId: "buy2", remainingQuantity: 7, costBasisRemaining: 1050n });
    expect(allocationsBySellTradeId.get("sell1")).toEqual([
      { buyTradeId: "buy2", quantity: 3 },
      { buyTradeId: "buy1", quantity: 5 },
    ]);
  });

  it("una allocation explícita que excede la cantidad vendida se recorta, nunca vende de más", () => {
    const trades = [
      { id: "buy1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "sell1", instrumentId: "AAPL", kind: "sell", quantity: 3, price: 200, netAmount: 600n, executedAt: "2026-02-01T00:00:00Z" },
    ];
    // La allocation pide 100 pero la venta es de solo 3.
    const explicit = new Map([["sell1", [{ buyTradeId: "buy1", quantity: 100 }]]]);
    const { lotsByInstrument, allocationsBySellTradeId } = computeLots(trades, explicit);
    expect(lotsByInstrument.get("AAPL")![0]).toMatchObject({ remainingQuantity: 7 });
    expect(allocationsBySellTradeId.get("sell1")).toEqual([{ buyTradeId: "buy1", quantity: 3 }]);
  });

  it("sin allocations explícitas para esa venta, cae a FIFO — retrocompatible con ventas cargadas antes de esta tabla", () => {
    const trades = [
      { id: "buy1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "sell1", instrumentId: "AAPL", kind: "sell", quantity: 5, price: 200, netAmount: 1000n, executedAt: "2026-02-01T00:00:00Z" },
    ];
    const withEmptyMap = computeLots(trades, new Map());
    const withoutMap = computeLots(trades);
    expect(withEmptyMap.lotsByInstrument.get("AAPL")).toEqual(withoutMap.lotsByInstrument.get("AAPL"));
  });

  it("instrumentos distintos no se mezclan", () => {
    const trades = [
      { id: "1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "2", instrumentId: "BTC", kind: "buy", quantity: 0.5, price: 40000, netAmount: 2000n, executedAt: "2026-01-01T00:00:00Z" },
    ];
    const { lotsByInstrument } = computeLots(trades);
    expect(lotsByInstrument.size).toBe(2);
    expect(lotsByInstrument.get("BTC")![0]!.remainingQuantity).toBe(0.5);
  });
});
