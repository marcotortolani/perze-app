import { createClient } from "../supabase/client";

export type SplitMode = "equal" | "income_pro_rata" | "exact" | "percent";

/** A6 — mismos valores que `transactions.fx_source`; el share hereda el estado del padre. */
export type ChildFxSource = "identity" | "api" | "manual" | "inherited" | "pending";

export interface TransactionShare {
  id: string;
  transactionId: string;
  memberId: string;
  shareAmount: bigint;
  shareAmountBase: bigint | null;
  fxSource: ChildFxSource;
  sharePct: number | null;
  splitMode: SplitMode | null;
  settledAt: string | null;
  settlementId: string | null;
}

export interface NewShareInput {
  transactionId: string;
  memberId: string;
  shareAmount: bigint;
  shareAmountBase: bigint | null;
  sharePct: number | null;
  splitMode: SplitMode;
}

/**
 * J5/J6/J7 — `transaction_shares` vive solo en Supabase: repartir un gasto
 * es, por definición, información sobre otros miembros del household
 * (cuánto le toca a cada uno), la misma excepción de "lecturas que
 * necesitan Realtime" que `invites-repo.ts`/`visibility-grants-repo.ts`.
 */
export const transactionSharesRepo = {
  async listForTransaction(transactionId: string): Promise<TransactionShare[]> {
    const supabase = createClient();
    // `share_amount(_base)::text` — nunca dejar que PostgREST serialice el
    // bigint como JSON number (mismo patrón que `/api/fx`).
    const { data, error } = await supabase
      .from("transaction_shares")
      .select("id, transaction_id, member_id, share_amount::text, share_amount_base::text, fx_source, share_pct, split_mode, settled_at, settlement_id")
      .eq("transaction_id", transactionId)
      .is("deleted_at", null)
      .returns<ShareRow[]>();
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  /** J7 — todos los shares sin liquidar del household, para calcular el neto. */
  async listUnsettledForHousehold(householdId: string): Promise<(TransactionShare & { currencyCode: string; createdBy: string })[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("transaction_shares")
      .select(
        "id, transaction_id, member_id, share_amount::text, share_amount_base::text, fx_source, share_pct, split_mode, settled_at, settlement_id, transactions!inner(household_id, currency_code, created_by, deleted_at)"
      )
      .is("deleted_at", null)
      .is("settled_at", null)
      .eq("transactions.household_id", householdId)
      .is("transactions.deleted_at", null)
      .returns<(ShareRow & { transactions: { household_id: string; currency_code: string; created_by: string; deleted_at: string | null } })[]>();
    if (error) throw error;
    return (data ?? []).map((row) => ({
      ...fromRow(row),
      currencyCode: row.transactions.currency_code,
      createdBy: row.transactions.created_by,
    }));
  },

  /** Reemplaza el reparto anterior de una transacción (soft-delete + insert), nunca lo pisa in-place. */
  async replaceSplit(transactionId: string, shares: NewShareInput[]): Promise<void> {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("transaction_shares")
      .update({ deleted_at: new Date().toISOString() })
      .eq("transaction_id", transactionId)
      .is("deleted_at", null);
    if (deleteError) throw deleteError;

    if (shares.length === 0) return;

    // El tipo generado declara `share_amount: number` (bigint de Postgres,
    // visto por PostgREST) — se manda como string a propósito para no
    // pasar por un `number` de JS; Postgres lo castea bien en el INSERT.
    const { error: insertError } = await supabase.from("transaction_shares").insert(
      shares.map((s) => ({
        id: crypto.randomUUID(),
        transaction_id: s.transactionId,
        member_id: s.memberId,
        share_amount: s.shareAmount.toString(),
        share_amount_base: s.shareAmountBase === null ? null : s.shareAmountBase.toString(),
        share_pct: s.sharePct,
        split_mode: s.splitMode,
      })) as never[]
    );
    if (insertError) throw insertError;
  },

  async markSettled(shareIds: string[], settlementId: string): Promise<void> {
    if (shareIds.length === 0) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("transaction_shares")
      .update({ settled_at: new Date().toISOString(), settlement_id: settlementId })
      .in("id", shareIds);
    if (error) throw error;
  },
};

interface ShareRow {
  id: string;
  transaction_id: string;
  member_id: string;
  share_amount: string;
  share_amount_base: string | null;
  fx_source: string;
  share_pct: number | string | null;
  split_mode: string | null;
  settled_at: string | null;
  settlement_id: string | null;
}

function fromRow(row: ShareRow): TransactionShare {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    memberId: row.member_id,
    shareAmount: BigInt(row.share_amount),
    shareAmountBase: row.share_amount_base === null ? null : BigInt(row.share_amount_base),
    fxSource: row.fx_source as ChildFxSource,
    sharePct: row.share_pct === null ? null : Number(row.share_pct),
    splitMode: row.split_mode as SplitMode | null,
    settledAt: row.settled_at,
    settlementId: row.settlement_id,
  };
}
