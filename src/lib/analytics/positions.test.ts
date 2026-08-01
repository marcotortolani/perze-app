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
});
