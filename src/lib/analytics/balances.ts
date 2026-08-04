import { add, money, type Money, zero } from "../money/money";
import type { AccountKind } from "../db/schema";

/** Único lugar que decide qué tipos de cuenta son pasivo — antes vivía duplicado, a mano, en `AccountsListContent.tsx`. */
export const LIABILITY_ACCOUNT_KINDS: ReadonlySet<AccountKind> = new Set(["credit_card", "loan"]);

export interface NetWorthAccountInput {
  id: string;
  currentBalance: bigint;
  currencyCode: string;
  includeInNetWorth: boolean;
  /** Tarjeta de crédito / préstamo — ver `LIABILITY_ACCOUNT_KINDS`. Default `false`. */
  isLiability?: boolean | undefined;
}

export interface NetWorthResult {
  /** Convertido a la moneda base del household. */
  netWorth: Money;
  /**
   * Subtotales, convertidos a la moneda base con la MISMA tasa por cuenta
   * que arma `netWorth` — antes `/accounts` los sumaba en la propia
   * moneda de cada cuenta sin convertir nada (`assetsTotal`/
   * `liabilitiesTotal` como un `reduce` directo sobre `currentBalance`),
   * así que una tarjeta en ARS se sumaba 1:1 como si fueran dólares. Nunca
   * calcular estos dos aparte del total — sería la misma clase de bug de
   * vuelta.
   */
  assets: Money;
  liabilities: Money;
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
  let assets = zero(baseCurrency);
  let liabilities = zero(baseCurrency);
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

    // Mismo recorte que ya usaba `/accounts`: una cuenta de tipo pasivo
    // (tarjeta, préstamo) solo entra al subtotal de pasivos si de verdad
    // está en deuda (saldo negativo) — una tarjeta sobrepagada no "resta"
    // pasivo, ni tampoco cuenta como activo; sigue sumando al total igual.
    if (account.isLiability) {
      if (account.currentBalance < 0n) liabilities = add(liabilities, converted);
    } else {
      assets = add(assets, converted);
    }
  }

  return { netWorth: total, assets, liabilities, included, excludedAccountIds };
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
