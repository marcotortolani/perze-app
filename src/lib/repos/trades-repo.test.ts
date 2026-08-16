import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import { outbox } from "../offline/outbox";
import { tradesRepo, type NewTradeInput } from "./trades-repo";

const PORTFOLIO = "portfolio-1";
const INSTRUMENT = "instrument-1";
const USER = "user-1";

function newTrade(overrides: Partial<NewTradeInput> = {}): NewTradeInput {
  return {
    portfolioId: PORTFOLIO,
    instrumentId: INSTRUMENT,
    createdBy: USER,
    kind: "buy",
    executedAt: "2026-08-10T12:00:00.000Z",
    quantity: 10,
    price: 100,
    currencyCode: "USD",
    grossAmount: 1000n,
    netAmount: 1000n,
    settlementAccountId: null,
    amountBase: null,
    fxRate: null,
    fxSource: "pending",
    ...overrides,
  };
}

/**
 * Auditoría de outbox de inversiones — antes `trades-repo.ts` escribía
 * directo a Supabase: una operación cargada sin conexión se perdía. Este
 * archivo cubre el invariante nuevo, mismo criterio que
 * `accounts-repo.test.ts`: guardar es local (Dexie) y encola en el
 * outbox, nunca llama a la red directamente.
 */
describe("tradesRepo — local-first (Dexie + outbox)", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-trades-repo-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("create() guarda en Dexie y encola un insert en el outbox, sin tocar la red", async () => {
    const trade = await tradesRepo.create(newTrade());

    const stored = await getDb().trades.get(trade.id);
    expect(stored).toMatchObject({ portfolioId: PORTFOLIO, instrumentId: INSTRUMENT, kind: "buy", clientRev: 1, deletedAt: null });

    const queued = await outbox.listAll();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ table: "trades", op: "insert", entityId: trade.id, clientRev: 1 });
  });

  it("create() convierte el fxRate decimal a ScaledRate para guardarlo localmente", async () => {
    const trade = await tradesRepo.create(newTrade({ fxRate: "40.5", amountBase: 40500n, fxSource: "api" }));
    // ScaledRate = decimal × 10^12 (`RATE_SCALE`, `lib/fx/rate.ts`).
    expect(trade.fxRate).toBe(40_500_000_000_000n);
    expect(trade.amountBase).toBe(40500n);
  });

  it("update() no puede fallar en silencio sobre un trade que no existe", async () => {
    await expect(tradesRepo.update("no-existe", newTrade())).rejects.toThrow(/no encontrado/);
    expect(await outbox.listAll()).toHaveLength(0);
  });

  it("update() incrementa clientRev y no toca portfolioId/instrumentId/createdBy", async () => {
    const trade = await tradesRepo.create(newTrade());
    const updated = await tradesRepo.update(trade.id, newTrade({ quantity: 20, price: 200, grossAmount: 4000n, netAmount: 4000n }));

    expect(updated.clientRev).toBe(2);
    expect(updated.quantity).toBe(20);
    expect(updated.portfolioId).toBe(PORTFOLIO);
    expect(updated.instrumentId).toBe(INSTRUMENT);
    expect(updated.createdBy).toBe(USER);

    const queued = await outbox.listAll();
    expect(queued).toHaveLength(2);
    expect(queued[1]).toMatchObject({ table: "trades", op: "update", entityId: trade.id, clientRev: 2 });
  });

  it("softDelete()/restore() son reversibles y encolan cada paso", async () => {
    const trade = await tradesRepo.create(newTrade());
    await tradesRepo.softDelete(trade.id);

    expect(await tradesRepo.get(trade.id)).toBeNull();
    expect(await tradesRepo.listForPortfolio(PORTFOLIO)).toHaveLength(0);

    await tradesRepo.restore(trade.id);
    expect(await tradesRepo.get(trade.id)).not.toBeNull();
    expect(await tradesRepo.listForPortfolio(PORTFOLIO)).toHaveLength(1);

    const queued = await outbox.listAll();
    expect(queued.map((q) => q.op)).toEqual(["insert", "update", "update"]);
  });

  it("listForPortfolio() ordena por executedAt descendente y excluye soft-deleted", async () => {
    const older = await tradesRepo.create(newTrade({ executedAt: "2026-08-01T12:00:00.000Z" }));
    const newer = await tradesRepo.create(newTrade({ executedAt: "2026-08-10T12:00:00.000Z" }));
    const deleted = await tradesRepo.create(newTrade({ executedAt: "2026-08-15T12:00:00.000Z" }));
    await tradesRepo.softDelete(deleted.id);

    const list = await tradesRepo.listForPortfolio(PORTFOLIO);
    expect(list.map((t) => t.id)).toEqual([newer.id, older.id]);
  });
});
