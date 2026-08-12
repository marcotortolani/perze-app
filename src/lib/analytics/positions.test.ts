import { describe, expect, it } from "vitest";
import { computePositions } from "./positions";

describe("computePositions", () => {
  it("accumulates quantity and cost basis across buys", () => {
    const positions = computePositions([
      { instrumentId: "AAPL", kind: "buy", quantity: 10, netAmount: 1000n },
      { instrumentId: "AAPL", kind: "buy", quantity: 5, netAmount: 600n },
    ]);
    const pos = positions.get("AAPL")!;
    expect(pos.quantity).toBe(15);
    expect(pos.costBasis).toBe(1600n);
  });

  it("reduces quantity and cost basis proportionally on a partial sell", () => {
    const positions = computePositions([
      { instrumentId: "AAPL", kind: "buy", quantity: 10, netAmount: 1000n },
      { instrumentId: "AAPL", kind: "sell", quantity: 5, netAmount: 550n },
    ]);
    const pos = positions.get("AAPL")!;
    expect(pos.quantity).toBe(5);
    expect(pos.costBasis).toBe(500n); // half the original cost basis remains
  });

  it("closes a position entirely sold out — it doesn't linger at 0", () => {
    const positions = computePositions([
      { instrumentId: "AAPL", kind: "buy", quantity: 10, netAmount: 1000n },
      { instrumentId: "AAPL", kind: "sell", quantity: 10, netAmount: 1200n },
    ]);
    expect(positions.has("AAPL")).toBe(false);
  });

  it("ignores non-quantity trade kinds like dividends and fees", () => {
    const positions = computePositions([
      { instrumentId: "AAPL", kind: "buy", quantity: 10, netAmount: 1000n },
      { instrumentId: "AAPL", kind: "dividend", quantity: 0, netAmount: 50n },
      { instrumentId: "AAPL", kind: "fee", quantity: 0, netAmount: -10n },
    ]);
    const pos = positions.get("AAPL")!;
    expect(pos.quantity).toBe(10);
    expect(pos.costBasis).toBe(1000n);
  });

  it("tracks multiple instruments independently", () => {
    const positions = computePositions([
      { instrumentId: "AAPL", kind: "buy", quantity: 10, netAmount: 1000n },
      { instrumentId: "BTC", kind: "buy", quantity: 0.5, netAmount: 2000n },
    ]);
    expect(positions.size).toBe(2);
    expect(positions.get("BTC")!.quantity).toBe(0.5);
  });

  it("transfer_in (posición inicial) suma cantidad y costo base igual que una compra", () => {
    const positions = computePositions([{ instrumentId: "SPCX", kind: "transfer_in", quantity: 10, netAmount: 1000n }]);
    const pos = positions.get("SPCX")!;
    expect(pos.quantity).toBe(10);
    expect(pos.costBasis).toBe(1000n);
  });

  it("una compra posterior se suma sobre la posición inicial cargada con transfer_in", () => {
    const positions = computePositions([
      { instrumentId: "SPCX", kind: "transfer_in", quantity: 10, netAmount: 1000n },
      { instrumentId: "SPCX", kind: "buy", quantity: 5, netAmount: 600n },
    ]);
    const pos = positions.get("SPCX")!;
    expect(pos.quantity).toBe(15);
    expect(pos.costBasis).toBe(1600n);
  });

  it("transfer_out reduce cantidad y costo base proporcionalmente, igual que una venta", () => {
    const positions = computePositions([
      { instrumentId: "SPCX", kind: "transfer_in", quantity: 10, netAmount: 1000n },
      { instrumentId: "SPCX", kind: "transfer_out", quantity: 5, netAmount: 0n },
    ]);
    const pos = positions.get("SPCX")!;
    expect(pos.quantity).toBe(5);
    expect(pos.costBasis).toBe(500n);
  });

  it("transfer_in + venta total cierra la posición — no queda en 0 para siempre", () => {
    const positions = computePositions([
      { instrumentId: "SPCX", kind: "transfer_in", quantity: 10, netAmount: 1000n },
      { instrumentId: "SPCX", kind: "sell", quantity: 10, netAmount: 1200n },
    ]);
    expect(positions.has("SPCX")).toBe(false);
  });

  it("revaluation no mueve cantidad ni costo base", () => {
    const positions = computePositions([
      { instrumentId: "SPCX", kind: "transfer_in", quantity: 10, netAmount: 1000n },
      { instrumentId: "SPCX", kind: "revaluation", quantity: 0, netAmount: 500n },
    ]);
    const pos = positions.get("SPCX")!;
    expect(pos.quantity).toBe(10);
    expect(pos.costBasis).toBe(1000n);
  });
});
