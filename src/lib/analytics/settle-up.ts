/**
 * J7 — el agregado más delicado de la app (CLAUDE.md): un gasto compartido
 * sin cotización resuelta NUNCA se cuenta como si valiera 0, ni se
 * inventa un rate=1. Se excluye del neto y se declara el conteo excluido
 * — la misma regla de needs_fx que todo lo demás, aplicada a "quién le
 * debe a quién".
 */

export interface UnsettledShareInput {
  memberId: string;
  /** `null` = needs_fx todavía sin resolver — se excluye, nunca se cuenta como 0. */
  shareAmountBase: bigint | null;
  /** Quién pagó la transacción original (dueño del gasto, a quien se le debe el share de los demás). */
  paidBy: string;
}

export interface NetBalance {
  /** Positivo = ese miembro te debe a vos; negativo = vos le debés a él. */
  byMember: Map<string, bigint>;
  excludedCount: number;
}

export function computeNetBalances(shares: readonly UnsettledShareInput[], currentUserId: string): NetBalance {
  const byMember = new Map<string, bigint>();
  let excludedCount = 0;

  for (const share of shares) {
    // El share del propio pagador no es una deuda — es su parte del gasto que ya cubrió.
    if (share.memberId === share.paidBy) continue;
    // Ningún share de un tercer par (ninguno de los dos es el usuario actual) afecta el neto de este usuario.
    if (share.memberId !== currentUserId && share.paidBy !== currentUserId) continue;

    if (share.shareAmountBase === null) {
      excludedCount += 1;
      continue;
    }

    const counterpart = share.memberId === currentUserId ? share.paidBy : share.memberId;
    const sign = share.paidBy === currentUserId ? 1n : -1n; // te deben (+) o debés (-)
    byMember.set(counterpart, (byMember.get(counterpart) ?? 0n) + sign * share.shareAmountBase);
  }

  return { byMember, excludedCount };
}
