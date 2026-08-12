import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db/client";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { recurringRulesRepo } from "@/lib/repos/recurring-rules-repo";
import { fxRepo } from "@/lib/repos/fx-repo";
import { RATE_SCALE, rateFromAmounts, rateFromInteger } from "@/lib/fx/rate";
import { money } from "@/lib/money/money";
import type { AccountRow, HouseholdRow, RecurringRuleRow } from "@/lib/db/schema";
import { chargeRecurringNow, convertRuleAmountToAccount, materializeDueRecurring, needsChargePreview, resolveChargeAccount } from "./materialize";

const HOUSEHOLD: HouseholdRow = {
  id: "hh-1",
  name: "Casa",
  baseCurrency: "UYU",
  baseCountry: "UY",
  periodStartDay: 1,
  weekStart: 1,
  enabledModules: [],
  settings: {},
  createdBy: "user-1",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  clientRev: 1,
  purgedAt: null,
};

async function makeAccount(overrides: Partial<AccountRow> & Pick<AccountRow, "currencyCode" | "openingBalance">): Promise<AccountRow> {
  return accountsRepo.create({
    householdId: HOUSEHOLD.id,
    ownerId: "user-1",
    name: "Cuenta",
    kind: "wallet",
    institutionId: null,
    countryCode: null,
    openingDate: "2026-07-01",
    creditLimit: null,
    statementDay: null,
    dueDay: null,
    interestRate: null,
    termMonths: null,
    includeInNetWorth: true,
    visibility: "household",
    color: null,
    icon: null,
    archivedAt: null,
    createdBy: "user-1",
    ...overrides,
  });
}

function makeRule(overrides: Partial<RecurringRuleRow>): RecurringRuleRow {
  return {
    id: "rule-1",
    householdId: HOUSEHOLD.id,
    name: "Alquiler",
    kind: "expense",
    categoryId: null,
    accountId: "acc-primary",
    fallbackAccountId: null,
    expectedAmount: 10_000n,
    currencyCode: "UYU",
    frequency: "monthly",
    anchorDate: "2026-07-08",
    dayOfMonth: 8,
    autoPost: false,
    endDate: null,
    archivedAt: null,
    createdBy: "user-1",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    clientRev: 1,
    ...overrides,
  };
}

describe("resolveChargeAccount — a dónde postea 'Cargar ahora'", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-materialize-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("sin cuenta de respaldo: siempre la principal", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: null });

    const result = await resolveChargeAccount(HOUSEHOLD.id, rule, primary, null, "2026-08-08");

    expect(result.account.id).toBe(primary.id);
    expect(result.usedFallback).toBe(false);
    expect(result.original).toBeNull();
  });

  it("cuenta principal con fondos suficientes: no usa el respaldo aunque exista", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: 50_000n });
    const fallback = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: fallback.id, expectedAmount: 10_000n });

    const result = await resolveChargeAccount(HOUSEHOLD.id, rule, primary, fallback, "2026-08-08");

    expect(result.account.id).toBe(primary.id);
    expect(result.usedFallback).toBe(false);
  });

  it("misma moneda, principal sin fondos: usa el respaldo con el mismo monto", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const fallback = await makeAccount({ currencyCode: "UYU", openingBalance: 100_000n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: fallback.id, expectedAmount: 10_000n });

    const result = await resolveChargeAccount(HOUSEHOLD.id, rule, primary, fallback, "2026-08-08");

    expect(result.account.id).toBe(fallback.id);
    expect(result.usedFallback).toBe(true);
    expect(result.amount.amount).toBe(10_000n);
    expect(result.original).toBeNull();
  });

  it("otra moneda, principal sin fondos, con cotización: convierte al respaldo y guarda el original", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const fallback = await makeAccount({ currencyCode: "USD", openingBalance: 100_000n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: fallback.id, currencyCode: "UYU", expectedAmount: 40_000n });
    await fxRepo.setManualOverride(HOUSEHOLD.id, "UYU", "USD", rateFromInteger(1) / 40n); // 1 UYU = 0.025 USD

    const result = await resolveChargeAccount(HOUSEHOLD.id, rule, primary, fallback, "2026-08-08");

    expect(result.account.id).toBe(fallback.id);
    expect(result.usedFallback).toBe(true);
    expect(result.amount.amount).toBe(1000n); // UYU 400,00 * 0,025 = USD 10,00 (1.000 unidades mínimas, 2 decimales)
    expect(result.original).toEqual({ originalAmount: 40_000n, originalCurrency: "UYU", originalRate: rateFromInteger(1) / 40n });
  });

  it("otra moneda, principal sin fondos, sin cotización: se queda en la principal y avisa", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const fallback = await makeAccount({ currencyCode: "USD", openingBalance: 100_000n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: fallback.id, currencyCode: "UYU", expectedAmount: 40_000n });

    const result = await resolveChargeAccount(HOUSEHOLD.id, rule, primary, fallback, "2026-08-08");

    expect(result.account.id).toBe(primary.id);
    expect(result.usedFallback).toBe(false);
    expect(result.fallbackSkippedNoRate).toBe(true);
  });

  it("un ingreso nunca usa el respaldo, aunque la principal esté en negativo", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: -5_000n });
    const fallback = await makeAccount({ currencyCode: "UYU", openingBalance: 100_000n });
    const rule = makeRule({ kind: "income", accountId: primary.id, fallbackAccountId: fallback.id, expectedAmount: 10_000n });

    const result = await resolveChargeAccount(HOUSEHOLD.id, rule, primary, fallback, "2026-08-08");

    expect(result.account.id).toBe(primary.id);
    expect(result.usedFallback).toBe(false);
  });

  it("con `rateOverride`: se usa tal cual, sin resolver — gana aunque haya cotización automática distinta", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const fallback = await makeAccount({ currencyCode: "USD", openingBalance: 100_000n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: fallback.id, currencyCode: "UYU", expectedAmount: 40_000n });
    await fxRepo.setManualOverride(HOUSEHOLD.id, "UYU", "USD", rateFromInteger(1) / 40n); // sugerida: 1 UYU = 0,025 USD
    const userOverride = rateFromInteger(1) / 39n + 1n; // valor distinto, "lo que dio el banco de verdad"

    const result = await resolveChargeAccount(HOUSEHOLD.id, rule, primary, fallback, "2026-08-08", userOverride);

    expect(result.account.id).toBe(fallback.id);
    expect(result.original?.originalRate).toBe(userOverride);
  });

  it("con `rateOverride`: funciona incluso sin ninguna cotización automática disponible (antes caía a la principal)", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const fallback = await makeAccount({ currencyCode: "USD", openingBalance: 100_000n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: fallback.id, currencyCode: "UYU", expectedAmount: 39_200n });
    // 39.200 UYU (real: -$U 39.200,00) descontó USD 1.000,00 de verdad — la tasa se infiere del
    // monto real, no al revés, igual que hace `PayCardSheet.focusCardField()`.
    const manualRate = rateFromAmounts(money(39_200n, "UYU"), money(100_000n, "USD"))!;

    const result = await resolveChargeAccount(HOUSEHOLD.id, rule, primary, fallback, "2026-08-08", manualRate);

    expect(result.account.id).toBe(fallback.id);
    expect(result.usedFallback).toBe(true);
    expect(result.fallbackSkippedNoRate).toBe(false);
    expect(result.amount.amount).toBe(100_000n); // USD 1.000,00
  });

  it("regla en otra moneda que la PRINCIPAL, sin respaldo, con cotización: convierte y guarda el original — caso nuevo (alquiler en UYU pagado desde cuenta USD)", async () => {
    const primary = await makeAccount({ currencyCode: "USD", openingBalance: 1_000_000n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: null, currencyCode: "UYU", expectedAmount: 40_000n });
    await fxRepo.setManualOverride(HOUSEHOLD.id, "UYU", "USD", rateFromInteger(1) / 40n); // 1 UYU = 0,025 USD

    const result = await resolveChargeAccount(HOUSEHOLD.id, rule, primary, null, "2026-08-08");

    expect(result.account.id).toBe(primary.id);
    expect(result.usedFallback).toBe(false);
    expect(result.amount.amount).toBe(1000n); // UYU 400,00 * 0,025 = USD 10,00
    expect(result.original).toEqual({ originalAmount: 40_000n, originalCurrency: "UYU", originalRate: rateFromInteger(1) / 40n });
  });

  it("regla en otra moneda que la principal, sin respaldo, sin cotización: nunca reinterpreta el número tipeado — monto 0, original con `originalRate: null`", async () => {
    const primary = await makeAccount({ currencyCode: "USD", openingBalance: 1_000_000n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: null, currencyCode: "UYU", expectedAmount: 40_000n });

    const result = await resolveChargeAccount(HOUSEHOLD.id, rule, primary, null, "2026-08-08");

    expect(result.account.id).toBe(primary.id);
    expect(result.amount.amount).toBe(0n);
    expect(result.original).toEqual({ originalAmount: 40_000n, originalCurrency: "UYU", originalRate: null });
    expect(result.fallbackSkippedNoRate).toBe(false); // no hay respaldo que "saltear" acá
  });

  it("regla en otra moneda que la principal, con `amountOverride` (servicio variable, la boleta vino distinta a lo esperado)", async () => {
    const primary = await makeAccount({ currencyCode: "USD", openingBalance: 1_000_000n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: null, currencyCode: "UYU", expectedAmount: 160_000n }); // esperado: UYU 1.600,00
    const rate = rateFromInteger(1) / 40n; // 1 UYU = 0,025 USD
    const realAmount = 185_000n; // la boleta vino en UYU 1.850,00, no lo esperado

    const result = await resolveChargeAccount(HOUSEHOLD.id, rule, primary, null, "2026-08-08", rate, realAmount);

    expect(result.original?.originalAmount).toBe(realAmount);
    expect(result.amount.amount).toBe((realAmount * rate) / RATE_SCALE); // USD 46,25 — mismo par, sin redondeo (rate exacto)
  });

  it("regla en otra moneda que la principal, CON respaldo configurado: el respaldo no se evalúa, se carga directo en la principal — simplificación documentada", async () => {
    const primary = await makeAccount({ currencyCode: "USD", openingBalance: 0n });
    const fallback = await makeAccount({ currencyCode: "UYU", openingBalance: 1_000_000n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: fallback.id, currencyCode: "UYU", expectedAmount: 40_000n });
    await fxRepo.setManualOverride(HOUSEHOLD.id, "UYU", "USD", rateFromInteger(1) / 40n);

    const result = await resolveChargeAccount(HOUSEHOLD.id, rule, primary, fallback, "2026-08-08");

    expect(result.account.id).toBe(primary.id);
    expect(result.usedFallback).toBe(false);
  });
});

describe("convertRuleAmountToAccount — primera conversión de un recurrente", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-convert-rule-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("misma moneda: sin conversión, original en null", async () => {
    const account = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const rule = makeRule({ currencyCode: "UYU", expectedAmount: 25_000n });

    const result = await convertRuleAmountToAccount(HOUSEHOLD.id, rule, account, "2026-08-08");

    expect(result.amount).toEqual({ amount: 25_000n, currency: "UYU" });
    expect(result.original).toBeNull();
  });

  it("`amountOverride` reemplaza el monto pactado incluso en la rama de misma moneda", async () => {
    const account = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const rule = makeRule({ currencyCode: "UYU", expectedAmount: 25_000n });

    const result = await convertRuleAmountToAccount(HOUSEHOLD.id, rule, account, "2026-08-08", null, 27_500n);

    expect(result.amount.amount).toBe(27_500n);
    expect(result.original).toBeNull();
  });
});

describe("needsChargePreview — cuándo mostrar la preview editable antes de cargar", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-needs-fx-preview-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("sin cuenta de respaldo: no hace falta preview", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: null });
    expect(needsChargePreview(rule, primary, null)).toBe(false);
  });

  it("un ingreso: no hace falta preview aunque la principal esté en negativo", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: -5_000n });
    const fallback = await makeAccount({ currencyCode: "USD", openingBalance: 100_000n });
    const rule = makeRule({ kind: "income", accountId: primary.id, fallbackAccountId: fallback.id });
    expect(needsChargePreview(rule, primary, fallback)).toBe(false);
  });

  it("la principal alcanza: no hace falta preview aunque el respaldo esté en otra moneda", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: 50_000n });
    const fallback = await makeAccount({ currencyCode: "USD", openingBalance: 100_000n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: fallback.id, expectedAmount: 10_000n });
    expect(needsChargePreview(rule, primary, fallback)).toBe(false);
  });

  it("respaldo en la MISMA moneda: no hace falta preview, no hay tasa que revisar", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const fallback = await makeAccount({ currencyCode: "UYU", openingBalance: 100_000n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: fallback.id, expectedAmount: 10_000n });
    expect(needsChargePreview(rule, primary, fallback)).toBe(false);
  });

  it("respaldo en OTRA moneda y principal sin fondos: sí hace falta preview", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const fallback = await makeAccount({ currencyCode: "USD", openingBalance: 100_000n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: fallback.id, expectedAmount: 10_000n });
    expect(needsChargePreview(rule, primary, fallback)).toBe(true);
  });

  it("la regla ya está en otra moneda que la PRINCIPAL, sin respaldo: sí hace falta preview — caso nuevo", async () => {
    const primary = await makeAccount({ currencyCode: "USD", openingBalance: 1_000_000n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: null, currencyCode: "UYU", expectedAmount: 40_000n });
    expect(needsChargePreview(rule, primary, null)).toBe(true);
  });

  it("la regla y la principal comparten moneda: no hace falta preview aunque el monto sea $0", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: null, currencyCode: "UYU", expectedAmount: 0n });
    expect(needsChargePreview(rule, primary, null)).toBe(false);
  });

  it("coincide con `resolveChargeAccount`: exactamente cuando termina en la rama cross-currency (con o sin cotización)", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const fallback = await makeAccount({ currencyCode: "USD", openingBalance: 100_000n });
    const rule = makeRule({ accountId: primary.id, fallbackAccountId: fallback.id, currencyCode: "UYU", expectedAmount: 40_000n });

    expect(needsChargePreview(rule, primary, fallback)).toBe(true);
    const withoutRate = await resolveChargeAccount(HOUSEHOLD.id, rule, primary, fallback, "2026-08-08");
    expect(withoutRate.fallbackSkippedNoRate).toBe(true);

    await fxRepo.setManualOverride(HOUSEHOLD.id, "UYU", "USD", rateFromInteger(1) / 40n);
    const withRate = await resolveChargeAccount(HOUSEHOLD.id, rule, primary, fallback, "2026-08-08");
    expect(withRate.usedFallback).toBe(true);
    expect(withRate.original).not.toBeNull();
  });
});

describe("chargeRecurringNow — integración con el respaldo", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-charge-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("carga en el respaldo y no mueve el saldo de la cuenta principal", async () => {
    const primary = await makeAccount({ currencyCode: "UYU", openingBalance: 0n });
    const fallback = await makeAccount({ currencyCode: "UYU", openingBalance: 100_000n });
    const rule = await recurringRulesRepo.create({
      householdId: HOUSEHOLD.id,
      name: "Alquiler",
      kind: "expense",
      categoryId: null,
      accountId: primary.id,
      fallbackAccountId: fallback.id,
      expectedAmount: 10_000n,
      currencyCode: "UYU",
      frequency: "monthly",
      anchorDate: "2026-07-08",
      dayOfMonth: 8,
      autoPost: false,
      endDate: null,
      createdBy: "user-1",
    });

    const result = await chargeRecurringNow(HOUSEHOLD, "user-1", rule, "2026-08-08", "2026-08-08");

    expect(result.usedFallback).toBe(true);
    expect(result.transaction.accountId).toBe(fallback.id);
    expect((await accountsRepo.get(primary.id))?.currentBalance).toBe(0n);
    expect((await accountsRepo.get(fallback.id))?.currentBalance).toBe(90_000n);
  });

  it("regla en otra moneda que la cuenta, con `rateOverride` y `amountOverride`: la transacción queda con el monto confirmado en pantalla, nunca se vuelve a resolver", async () => {
    const primary = await makeAccount({ currencyCode: "USD", openingBalance: 1_000_000n });
    const rule = await recurringRulesRepo.create({
      householdId: HOUSEHOLD.id,
      name: "UTE",
      kind: "expense",
      categoryId: null,
      accountId: primary.id,
      fallbackAccountId: null,
      expectedAmount: 160_000n, // esperado: UYU 1.600,00
      currencyCode: "UYU",
      frequency: "monthly",
      anchorDate: "2026-07-08",
      dayOfMonth: 8,
      autoPost: false,
      endDate: null,
      createdBy: "user-1",
    });
    const rate = rateFromInteger(1) / 40n; // 1 UYU = 0,025 USD
    const realAmount = 185_000n; // la boleta vino en UYU 1.850,00

    const result = await chargeRecurringNow(HOUSEHOLD, "user-1", rule, "2026-08-08", "2026-08-08", rate, realAmount);

    expect(result.transaction.accountId).toBe(primary.id);
    expect(result.transaction.currencyCode).toBe("USD");
    expect(result.transaction.originalAmount).toBe(realAmount);
    expect(result.transaction.originalCurrency).toBe("UYU");
    expect(result.transaction.originalRate).toBe(rate);
    expect(result.transaction.amount).toBe((realAmount * rate) / RATE_SCALE);
  });

  it("auto-registro (`materializeDueRecurring`): regla en otra moneda que la cuenta, resuelve la tasa a la fecha de CADA ocurrencia", async () => {
    const primary = await makeAccount({ currencyCode: "USD", openingBalance: 1_000_000n });
    await recurringRulesRepo.create({
      householdId: HOUSEHOLD.id,
      name: "Alquiler",
      kind: "expense",
      categoryId: null,
      accountId: primary.id,
      fallbackAccountId: null,
      expectedAmount: 40_000n,
      currencyCode: "UYU",
      frequency: "monthly",
      anchorDate: "2026-08-08",
      dayOfMonth: 8,
      autoPost: true,
      endDate: null,
      createdBy: "user-1",
    });
    await fxRepo.setManualOverride(HOUSEHOLD.id, "UYU", "USD", rateFromInteger(1) / 40n);

    const created = await materializeDueRecurring(HOUSEHOLD, "user-1", "2026-08-08");

    expect(created).toHaveLength(1);
    expect(created[0]!.accountId).toBe(primary.id);
    expect(created[0]!.currencyCode).toBe("USD");
    expect(created[0]!.originalAmount).toBe(40_000n);
    expect(created[0]!.originalCurrency).toBe("UYU");
    expect(created[0]!.amount).toBe(1000n); // UYU 400,00 * 0,025 = USD 10,00
  });

  it("auto-registro, sin cotización disponible: se guarda igual, sin convertir — nunca un rate inventado", async () => {
    const primary = await makeAccount({ currencyCode: "USD", openingBalance: 1_000_000n });
    await recurringRulesRepo.create({
      householdId: HOUSEHOLD.id,
      name: "Alquiler",
      kind: "expense",
      categoryId: null,
      accountId: primary.id,
      fallbackAccountId: null,
      expectedAmount: 40_000n,
      currencyCode: "UYU",
      frequency: "monthly",
      anchorDate: "2026-08-08",
      dayOfMonth: 8,
      autoPost: true,
      endDate: null,
      createdBy: "user-1",
    });

    const created = await materializeDueRecurring(HOUSEHOLD, "user-1", "2026-08-08");

    expect(created).toHaveLength(1);
    expect(created[0]!.amount).toBe(0n);
    expect(created[0]!.originalAmount).toBe(40_000n);
    expect(created[0]!.originalCurrency).toBe("UYU");
    expect(created[0]!.originalRate).toBeNull();
  });
});
