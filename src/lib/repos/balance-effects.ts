import type { TransactionKind } from "../db/schema";

export interface BalanceEffect {
  accountId: string;
  /** Delta a aplicar sobre `accounts.currentBalance`, en la moneda de esa cuenta. */
  delta: bigint;
}

export interface TransactionForEffects {
  kind: TransactionKind;
  amount: bigint;
  accountId: string;
  counterAccountId: string | null;
  counterAmount: bigint | null;
}

/**
 * Reemplaza el trigger de Postgres de `docs/01-arquitectura-datos.md`
 * § 2.7 ("Saldos: snapshot + delta") mientras el saldo se mantiene en
 * Dexie: qué le pasa a `current_balance` de cada cuenta involucrada.
 * Función pura — el repo la usa para aplicar (al crear) y revertir (al
 * editar/borrar) dentro de una transacción de Dexie.
 */
export function computeTransactionEffects(tx: TransactionForEffects): BalanceEffect[] {
  switch (tx.kind) {
    case "expense":
      return [{ accountId: tx.accountId, delta: -tx.amount }];
    case "income":
      return [{ accountId: tx.accountId, delta: tx.amount }];
    case "adjustment":
      // `amount` ya trae el signo del ajuste (doc § 2.5).
      return [{ accountId: tx.accountId, delta: tx.amount }];
    case "investing":
      // Mismo criterio que `adjustment`: el signo ya viaja en `amount`
      // (negativo compra, positivo venta) — ver `recompute_account_balance`.
      return [{ accountId: tx.accountId, delta: tx.amount }];
    case "transfer": {
      if (!tx.counterAccountId) {
        throw new Error("Una transferencia necesita counterAccountId");
      }
      return [
        { accountId: tx.accountId, delta: -tx.amount },
        { accountId: tx.counterAccountId, delta: tx.counterAmount ?? tx.amount },
      ];
    }
  }
}

export function reverseEffects(effects: BalanceEffect[]): BalanceEffect[] {
  return effects.map((e) => ({ accountId: e.accountId, delta: -e.delta }));
}

/** Suma los deltas de varios efectos por cuenta, para aplicar un solo write por cuenta. */
export function mergeEffectsByAccount(effects: BalanceEffect[]): Map<string, bigint> {
  const merged = new Map<string, bigint>();
  for (const e of effects) {
    merged.set(e.accountId, (merged.get(e.accountId) ?? 0n) + e.delta);
  }
  return merged;
}
