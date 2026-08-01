import { createClient } from "../supabase/client";

export type TradeKind =
  | "buy"
  | "sell"
  | "dividend"
  | "coupon"
  | "amortization"
  | "interest"
  | "split"
  | "merger"
  | "fee"
  | "tax"
  | "deposit"
  | "withdrawal"
  | "transfer_in"
  | "transfer_out"
  | "revaluation";

export interface Trade {
  id: string;
  portfolioId: string;
  instrumentId: string;
  kind: TradeKind;
  executedAt: string;
  quantity: number;
  price: number;
  currencyCode: string;
  grossAmount: bigint;
  netAmount: bigint;
  amountBase: bigint | null;
}

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
  fxRate: string | null;
  fxSource: "identity" | "api" | "manual" | "inherited" | "pending";
}

interface TradeRow {
  id: string;
  portfolio_id: string;
  instrument_id: string;
  kind: string;
  executed_at: string;
  quantity: number;
  price: number;
  currency_code: string;
  gross_amount: string;
  net_amount: string;
  amount_base: string | null;
}

function fromRow(row: TradeRow): Trade {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    instrumentId: row.instrument_id,
    kind: row.kind as TradeKind,
    executedAt: row.executed_at,
    quantity: row.quantity,
    price: row.price,
    currencyCode: row.currency_code,
    grossAmount: BigInt(row.gross_amount),
    netAmount: BigInt(row.net_amount),
    amountBase: row.amount_base === null ? null : BigInt(row.amount_base),
  };
}

export const tradesRepo = {
  async listForPortfolio(portfolioId: string): Promise<Trade[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("trades")
      .select("id, portfolio_id, instrument_id, kind, executed_at, quantity, price, currency_code, gross_amount::text, net_amount::text, amount_base::text")
      .eq("portfolio_id", portfolioId)
      .is("deleted_at", null)
      .order("executed_at", { ascending: false })
      .returns<TradeRow[]>();
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async create(input: NewTradeInput): Promise<Trade> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("trades")
      .insert({
        id: crypto.randomUUID(),
        portfolio_id: input.portfolioId,
        instrument_id: input.instrumentId,
        created_by: input.createdBy,
        kind: input.kind,
        executed_at: input.executedAt,
        quantity: input.quantity,
        price: input.price,
        currency_code: input.currencyCode,
        gross_amount: input.grossAmount.toString(),
        net_amount: input.netAmount.toString(),
        settlement_account_id: input.settlementAccountId,
        amount_base: input.amountBase === null ? null : input.amountBase.toString(),
        fx_rate: input.fxRate,
        fx_source: input.fxSource,
        fx_resolved_at: input.amountBase === null ? null : new Date().toISOString(),
      } as never)
      .select("id, portfolio_id, instrument_id, kind, executed_at, quantity, price, currency_code, gross_amount::text, net_amount::text, amount_base::text")
      .single<TradeRow>();
    if (error) throw error;
    return fromRow(data);
  },
};
