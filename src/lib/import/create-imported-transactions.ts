import type { AccountRow, HouseholdRow } from "@/lib/db/schema";
import { rateFromInteger, convert } from "@/lib/fx/rate";
import { fxRepo } from "@/lib/repos/fx-repo";
import { todayIso } from "@/lib/repos/ids";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import { money } from "@/lib/money/money";
import { decimalsFor } from "@/lib/money/decimals";
import type { ImportedRow } from "./column-mapping";

/** K9c — vuelca las filas no-duplicadas como movimientos reales, con la misma resolución de FX que la captura manual (needs_fx nunca bloquea). */
export async function createImportedTransactions(rows: readonly ImportedRow[], household: HouseholdRow, account: AccountRow, userId: string): Promise<number> {
  const decimals = decimalsFor(account.currencyCode);
  let created = 0;

  for (const row of rows) {
    const minorUnits = BigInt(Math.round(Math.abs(row.amount) * 10 ** decimals));
    if (minorUnits === 0n) continue;
    const kind = row.amount < 0 ? "expense" : "income";
    const occurredAt = new Date(row.date).toISOString();
    const date = occurredAt.slice(0, 10);

    let fxRate: bigint | null;
    let fxSource: "identity" | "api" | "manual" | "inherited" | "pending";
    let fxProvider: string | null = null;
    let fxQuoteKind: string | null = null;
    let fxResolvedAt: string | null = null;
    let amountBase: bigint | null;

    if (account.currencyCode === household.baseCurrency) {
      fxRate = rateFromInteger(1);
      fxSource = "identity";
      fxResolvedAt = todayIso();
      amountBase = minorUnits;
    } else {
      const resolution = await fxRepo.resolve({ householdId: household.id, base: account.currencyCode, quote: household.baseCurrency, date });
      fxRate = resolution.rate;
      fxSource = resolution.source;
      fxProvider = resolution.provider;
      fxQuoteKind = resolution.quoteKind;
      fxResolvedAt = resolution.rate !== null ? new Date().toISOString() : null;
      amountBase = resolution.rate !== null ? convert(money(minorUnits, account.currencyCode), household.baseCurrency, resolution.rate).amount : null;
    }

    await transactionsRepo.create({
      householdId: household.id,
      createdBy: userId,
      kind,
      occurredAt,
      accountId: account.id,
      counterAccountId: null,
      amount: minorUnits,
      currencyCode: account.currencyCode,
      originalAmount: null,
      originalCurrency: null,
      originalRate: null,
      fxRate,
      fxSource,
      fxProvider,
      fxQuoteKind,
      fxResolvedAt,
      amountBase,
      counterAmount: null,
      counterCurrencyCode: null,
      counterFxRate: null,
      categoryId: null,
      payeeId: null,
      note: row.description || null,
      attachments: [],
      location: null,
      status: "cleared",
      visibility: "household",
      recurringId: null,
      installmentGroupId: null,
      installmentNumber: null,
      installmentTotal: null,
      source: "import",
    });
    created += 1;
  }

  return created;
}
