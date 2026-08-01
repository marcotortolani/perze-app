/**
 * J6 — reparto de un gasto entre miembros. La suma de los shares SIEMPRE
 * tiene que dar exactamente `total` (nunca un centavo de más/menos por
 * redondeo) — el resto de la división entera se lo lleva el primer
 * miembro de la lista, en vez de perderse.
 */

export interface SplitTarget {
  memberId: string;
}

export function splitEqual(total: bigint, members: readonly SplitTarget[]): Map<string, bigint> {
  const result = new Map<string, bigint>();
  const n = members.length;
  if (n === 0) return result;
  const base = total / BigInt(n);
  const remainder = Number(total % BigInt(n)); // siempre < n (int chico), seguro como Number
  members.forEach((m, i) => {
    result.set(m.memberId, base + (i < remainder ? 1n : 0n));
  });
  return result;
}

/** `percentages` en centésimos de punto porcentual (62.5 = 62.5%) — deben sumar ~100, no se valida acá. */
export function splitByPercent(total: bigint, percentages: ReadonlyMap<string, number>): Map<string, bigint> {
  const result = new Map<string, bigint>();
  const entries = [...percentages.entries()];
  let assigned = 0n;
  entries.forEach(([memberId, pct], i) => {
    if (i === entries.length - 1) {
      // El último se lleva el resto exacto — nunca hay drift de redondeo.
      result.set(memberId, total - assigned);
      return;
    }
    const share = (total * BigInt(Math.round(pct * 1000))) / 100_000n;
    assigned += share;
    result.set(memberId, share);
  });
  return result;
}

/** `amounts` ya vienen exactos (J6 "monto exacto") — la suma tiene que dar `total`, se valida en el caller (UI), no acá. */
export function splitExact(amounts: ReadonlyMap<string, bigint>): Map<string, bigint> {
  return new Map(amounts);
}
