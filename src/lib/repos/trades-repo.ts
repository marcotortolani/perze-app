import { getDb } from "../db/client";
import type { FxSourceValue, TradeRow } from "../db/schema";
import { outbox } from "../offline/outbox";
import { parseRate } from "../fx/rate";
import { newId, nowIso } from "./ids";

export type TradeKind = TradeRow["kind"];

/**
 * Auditoría de outbox de inversiones — antes este repo escribía directo a
 * Supabase (`portfolios-repo.ts` documentaba a `trades-repo.ts` como "el
 * repo que hay que migrar a local-first si hace falta cargar una operación
 * sin conexión"). Ahora sí: mismo patrón Dexie + outbox que
 * `transactions-repo.ts`/`budgets-repo.ts` — guardar no puede fallar por
 * falta de señal, la red es un detalle del sync loop.
 *
 * `Trade` es literalmente `TradeRow` (la fila de Dexie) — no hace falta un
 * mapeo propio porque los callers ya consumían exactamente esta forma
 * (bigint para plata, `fxRate` como `ScaledRate`) desde antes de esta
 * migración.
 */
export type Trade = TradeRow;

export interface NewTradeInput {
  portfolioId: string;
  instrumentId: string;
  createdBy: string;
  kind: TradeKind;
  executedAt: string;
  quantity: number;
  price: number;
  currencyCode: string;
  grossAmount: bigint;
  netAmount: bigint;
  settlementAccountId: string | null;
  amountBase: bigint | null;
  /** Decimal plano ("1234.567890123456"), formato en que `fxRepo.resolve()`/`formatRate()` lo entregan — nunca `ScaledRate` crudo. */
  fxRate: string | null;
  fxSource: FxSourceValue;
}

/** Igual que `NewTradeInput` sin `portfolioId`/`instrumentId`/`createdBy`: a qué instrumento y portfolio pertenece una operación no se edita, solo sus datos. */
export type TradeUpdateInput = Omit<NewTradeInput, "portfolioId" | "instrumentId" | "createdBy">;

async function enqueueTrade(op: "insert" | "update", row: TradeRow): Promise<void> {
  await outbox.enqueue({ table: "trades", op, entityId: row.id, payload: row, clientRev: row.clientRev });
}

export const tradesRepo = {
  /** Detalle de transacción (`kind: 'investing'`) → editar el trade, no la transacción: hace falta `portfolioId` para armar esa URL y la fila de settlement no lo tiene. `null`, no `undefined` — mismo criterio que `transactionsRepo.get` (TanStack Query no acepta `undefined` de un `queryFn`). */
  async get(id: string): Promise<Trade | null> {
    const row = await getDb().trades.get(id);
    if (!row || row.deletedAt !== null) return null;
    return row;
  },

  async listForPortfolio(portfolioId: string): Promise<Trade[]> {
    const rows = await getDb().trades.where("portfolioId").equals(portfolioId).toArray();
    return rows.filter((t) => t.deletedAt === null).sort((a, b) => (a.executedAt < b.executedAt ? 1 : -1));
  },

  async create(input: NewTradeInput): Promise<Trade> {
    const db = getDb();
    const now = nowIso();
    const row: TradeRow = {
      portfolioId: input.portfolioId,
      instrumentId: input.instrumentId,
      createdBy: input.createdBy,
      kind: input.kind,
      executedAt: input.executedAt,
      quantity: input.quantity,
      price: input.price,
      currencyCode: input.currencyCode,
      grossAmount: input.grossAmount,
      netAmount: input.netAmount,
      settlementAccountId: input.settlementAccountId,
      amountBase: input.amountBase,
      fxRate: input.fxRate === null ? null : parseRate(input.fxRate),
      fxSource: input.fxSource,
      fxResolvedAt: input.amountBase === null ? null : now,
      note: null,
      id: newId(),
      createdAt: now,
      deletedAt: null,
      clientRev: 1,
    };

    await db.transaction("rw", db.trades, db.outbox, async () => {
      await db.trades.add(row);
      await enqueueTrade("insert", row);
    });

    return row;
  },

  /** No cambia `instrumentId`/`portfolioId`/`createdBy` — a qué instrumento pertenece una operación no se edita, solo sus datos (I4). */
  async update(id: string, input: TradeUpdateInput): Promise<Trade> {
    const db = getDb();
    let updated!: TradeRow;

    await db.transaction("rw", db.trades, db.outbox, async () => {
      const existing = await db.trades.get(id);
      if (!existing) throw new Error(`Trade ${id} no encontrado`);

      updated = {
        ...existing,
        kind: input.kind,
        executedAt: input.executedAt,
        quantity: input.quantity,
        price: input.price,
        currencyCode: input.currencyCode,
        grossAmount: input.grossAmount,
        netAmount: input.netAmount,
        settlementAccountId: input.settlementAccountId,
        amountBase: input.amountBase,
        fxRate: input.fxRate === null ? null : parseRate(input.fxRate),
        fxSource: input.fxSource,
        fxResolvedAt: input.amountBase === null ? null : nowIso(),
        clientRev: existing.clientRev + 1,
      };

      await db.trades.put(updated);
      await enqueueTrade("update", updated);
    });

    return updated;
  },

  /** Soft delete (`deleted_at`) — mismo patrón que `transactionsRepo`/`portfoliosRepo`, con `restore()` para el "Deshacer" del toast. Reversible, no confirmable: nunca un diálogo, siempre toast + deshacer. */
  async softDelete(id: string): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.trades, db.outbox, async () => {
      const existing = await db.trades.get(id);
      if (!existing || existing.deletedAt !== null) return;
      const updated: TradeRow = { ...existing, deletedAt: nowIso(), clientRev: existing.clientRev + 1 };
      await db.trades.put(updated);
      await enqueueTrade("update", updated);
    });
  },

  async restore(id: string): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.trades, db.outbox, async () => {
      const existing = await db.trades.get(id);
      if (!existing || existing.deletedAt === null) return;
      const updated: TradeRow = { ...existing, deletedAt: null, clientRev: existing.clientRev + 1 };
      await db.trades.put(updated);
      await enqueueTrade("update", updated);
    });
  },
};
