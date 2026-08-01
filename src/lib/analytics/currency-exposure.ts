import { add, money, type Money, zero } from "../money/money";
import type { NetWorthAccountInput } from "./balances";

export interface CurrencyExposureRow {
  currency: string;
  nativeAmount: Money;
  /** `null` cuando ninguna cuenta de esta moneda tiene tipo de cambio resuelto. */
  baseAmount: Money | null;
  pctOfNetWorth: number | null;
}

export interface CurrencyExposureResult {
  rows: CurrencyExposureRow[];
  totalBase: Money;
  /** Cuentas sin tipo de cambio resuelto, excluidas del total — nunca contadas como 0. */
  excludedAccountCount: number;
}

/**
 * H6 — exposición por moneda: cuánto patrimonio hay en cada moneda, en su
 * propia unidad y convertido a la base, con el % que representa. Mismo
 * invariante de `computeNetWorth`: una moneda sin tipo de cambio resuelto
 * no entra al total ni se muestra con un 0% inventado.
 */
export function computeCurrencyExposure(
  accounts: readonly NetWorthAccountInput[],
  baseCurrency: string,
  convert: (amount: Money, toCurrency: string) => Money | null
): CurrencyExposureResult {
  const included = accounts.filter((a) => a.includeInNetWorth);
  const nativeByCurrency = new Map<string, Money>();
  for (const account of included) {
    const amount = money(account.currentBalance, account.currencyCode);
    nativeByCurrency.set(account.currencyCode, add(nativeByCurrency.get(account.currencyCode) ?? zero(account.currencyCode), amount));
  }

  let totalBase = zero(baseCurrency);
  let excludedAccountCount = 0;
  const baseByCurrency = new Map<string, Money | null>();
  for (const [currency, nativeAmount] of nativeByCurrency) {
    if (currency === baseCurrency) {
      baseByCurrency.set(currency, nativeAmount);
      totalBase = add(totalBase, nativeAmount);
      continue;
    }
    const converted = convert(nativeAmount, baseCurrency);
    baseByCurrency.set(currency, converted);
    if (converted === null) {
      excludedAccountCount += included.filter((a) => a.currencyCode === currency).length;
    } else {
      totalBase = add(totalBase, converted);
    }
  }

  const totalBaseNumber = Number(totalBase.amount);
  const rows: CurrencyExposureRow[] = [...nativeByCurrency.entries()]
    .map(([currency, nativeAmount]) => {
      const baseAmount = baseByCurrency.get(currency) ?? null;
      const pctOfNetWorth = baseAmount !== null && totalBaseNumber !== 0 ? (Number(baseAmount.amount) / totalBaseNumber) * 100 : null;
      return { currency, nativeAmount, baseAmount, pctOfNetWorth };
    })
    .sort((a, b) => (b.baseAmount?.amount ?? 0n) > (a.baseAmount?.amount ?? 0n) ? 1 : -1);

  return { rows, totalBase, excludedAccountCount };
}
