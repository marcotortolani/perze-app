import { describe, expect, it } from "vitest";
import { computePositions } from "./positions";

describe("computePositions", () => {
  it("accumulates quantity and cost basis across buys", () => {
    const positions = computePositions([
      { id: "1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "2", instrumentId: "AAPL", kind: "buy", quantity: 5, price: 100, netAmount: 600n, executedAt: "2026-01-02T00:00:00Z" },
    ]);
    const pos = positions.get("AAPL")!;
    expect(pos.quantity).toBe(15);
    expect(pos.costBasis).toBe(1600n);
  });

  it("reduces quantity and cost basis proportionally on a partial sell", () => {
    const positions = computePositions([
      { id: "1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "2", instrumentId: "AAPL", kind: "sell", quantity: 5, price: 100, netAmount: 550n, executedAt: "2026-01-02T00:00:00Z" },
    ]);
    const pos = positions.get("AAPL")!;
    expect(pos.quantity).toBe(5);
    expect(pos.costBasis).toBe(500n); // half the original cost basis remains
  });

  it("closes a position entirely sold out — it doesn't linger at 0", () => {
    const positions = computePositions([
      { id: "1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "2", instrumentId: "AAPL", kind: "sell", quantity: 10, price: 100, netAmount: 1200n, executedAt: "2026-01-02T00:00:00Z" },
    ]);
    expect(positions.has("AAPL")).toBe(false);
  });

  it("ignores non-quantity trade kinds like dividends and fees", () => {
    const positions = computePositions([
      { id: "1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "2", instrumentId: "AAPL", kind: "dividend", quantity: 0, price: 100, netAmount: 50n, executedAt: "2026-01-02T00:00:00Z" },
      { id: "3", instrumentId: "AAPL", kind: "fee", quantity: 0, price: 100, netAmount: -10n, executedAt: "2026-01-03T00:00:00Z" },
    ]);
    const pos = positions.get("AAPL")!;
    expect(pos.quantity).toBe(10);
    expect(pos.costBasis).toBe(1000n);
  });

  it("tracks multiple instruments independently", () => {
    const positions = computePositions([
      { id: "1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "2", instrumentId: "BTC", kind: "buy", quantity: 0.5, price: 100, netAmount: 2000n, executedAt: "2026-01-01T00:00:00Z" },
    ]);
    expect(positions.size).toBe(2);
    expect(positions.get("BTC")!.quantity).toBe(0.5);
  });

  it("transfer_in (posición inicial) suma cantidad y costo base igual que una compra", () => {
    const positions = computePositions([{ id: "1", instrumentId: "SPCX", kind: "transfer_in", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" }]);
    const pos = positions.get("SPCX")!;
    expect(pos.quantity).toBe(10);
    expect(pos.costBasis).toBe(1000n);
  });

  it("una compra posterior se suma sobre la posición inicial cargada con transfer_in", () => {
    const positions = computePositions([
      { id: "1", instrumentId: "SPCX", kind: "transfer_in", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "2", instrumentId: "SPCX", kind: "buy", quantity: 5, price: 100, netAmount: 600n, executedAt: "2026-01-02T00:00:00Z" },
    ]);
    const pos = positions.get("SPCX")!;
    expect(pos.quantity).toBe(15);
    expect(pos.costBasis).toBe(1600n);
  });

  it("transfer_out reduce cantidad y costo base proporcionalmente, igual que una venta", () => {
    const positions = computePositions([
      { id: "1", instrumentId: "SPCX", kind: "transfer_in", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "2", instrumentId: "SPCX", kind: "transfer_out", quantity: 5, price: 100, netAmount: 0n, executedAt: "2026-01-02T00:00:00Z" },
    ]);
    const pos = positions.get("SPCX")!;
    expect(pos.quantity).toBe(5);
    expect(pos.costBasis).toBe(500n);
  });

  it("transfer_in + venta total cierra la posición — no queda en 0 para siempre", () => {
    const positions = computePositions([
      { id: "1", instrumentId: "SPCX", kind: "transfer_in", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "2", instrumentId: "SPCX", kind: "sell", quantity: 10, price: 100, netAmount: 1200n, executedAt: "2026-01-02T00:00:00Z" },
    ]);
    expect(positions.has("SPCX")).toBe(false);
  });

  it("revaluation no mueve cantidad ni costo base", () => {
    const positions = computePositions([
      { id: "1", instrumentId: "SPCX", kind: "transfer_in", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "2", instrumentId: "SPCX", kind: "revaluation", quantity: 0, price: 100, netAmount: 500n, executedAt: "2026-01-02T00:00:00Z" },
    ]);
    const pos = positions.get("SPCX")!;
    expect(pos.quantity).toBe(10);
    expect(pos.costBasis).toBe(1000n);
  });

  it("da el mismo resultado sin importar el orden de entrada — el cálculo es cronológico, no de llegada", () => {
    // `tradesRepo.listForPortfolio` devuelve `executed_at DESC`: si el
    // cálculo asumiera el orden de llegada, esta venta se procesaría ANTES
    // que su compra (reduciendo una posición vacía, sin efecto) y la compra
    // sumaría su costo completo sin descontar nada — costBasis quedaría en
    // 1000n en vez de 500n.
    const ascending = computePositions([
      { id: "1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
      { id: "2", instrumentId: "AAPL", kind: "sell", quantity: 5, price: 100, netAmount: 550n, executedAt: "2026-01-02T00:00:00Z" },
    ]);
    const descending = computePositions([
      { id: "2", instrumentId: "AAPL", kind: "sell", quantity: 5, price: 100, netAmount: 550n, executedAt: "2026-01-02T00:00:00Z" },
      { id: "1", instrumentId: "AAPL", kind: "buy", quantity: 10, price: 100, netAmount: 1000n, executedAt: "2026-01-01T00:00:00Z" },
    ]);
    expect(descending.get("AAPL")).toEqual(ascending.get("AAPL"));
    expect(descending.get("AAPL")!.costBasis).toBe(500n);
  });
});
