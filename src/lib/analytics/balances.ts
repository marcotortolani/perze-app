import { add, money, type Money, zero } from "../money/money";

export interface NetWorthAccountInput {
  id: string;
  currentBalance: bigint;
  currencyCode: string;
  includeInNetWorth: boolean;
}

export interface NetWorthResult {
  /** Convertido a la moneda base del household. */
  netWorth: Money;
  /** Cuentas que sí se pudieron convertir. */
  included: number;
  /** Cuentas excluidas por falta de tipo de cambio — nunca se cuentan como 0. */
  excludedAccountIds: string[];
}

/**
 * Patrimonio neto multi-moneda — `docs/01-arquitectura-datos.md` § 6:
 * "qué rate se usa (histórico vs. actual); pasivos con signo". El signo de
 * activo/pasivo ya está en `currentBalance` (una tarjeta de crédito en
 * deuda tiene saldo negativo) — acá solo se suma, convertido a moneda base.
 *
 * `convert` devuelve `null` cuando la cuenta tiene `needs_fx` (no hay
 * tipo de cambio resuelto): esa cuenta se excluye del total y se cuenta,
 * nunca se computa como si valiera 0 ni con su monto sin convertir.
 */
export function computeNetWorth(params: {
  accounts: readonly NetWorthAccountInput[];
  baseCurrency: string;
  convert: (amount: Money, toCurrency: string) => Money | null;
}): NetWorthResult {
  const { accounts, baseCurrency, convert } = params;

  let total = zero(baseCurrency);
  let included = 0;
  const excludedAccountIds: string[] = [];

  for (const account of accounts) {
    if (!account.includeInNetWorth) continue;

    const balance = money(account.currentBalance, account.currencyCode);
    const converted = account.currencyCode === baseCurrency ? balance : convert(balance, baseCurrency);

    if (converted === null) {
      excludedAccountIds.push(account.id);
      continue;
    }

    total = add(total, converted);
    included += 1;
  }

  return { netWorth: total, included, excludedAccountIds };
}

/** Suma de saldos de un grupo de cuentas EN SU PROPIA MONEDA — para el subtotal por moneda de E1. */
export function sumBalancesByCurrency(
  accounts: readonly NetWorthAccountInput[]
): Map<string, Money> {
  const byCurrency = new Map<string, Money>();
  for (const account of accounts) {
    const current = byCurrency.get(account.currencyCode) ?? zero(account.currencyCode);
    byCurrency.set(account.currencyCode, add(current, money(account.currentBalance, account.currencyCode)));
  }
  return byCurrency;
}
