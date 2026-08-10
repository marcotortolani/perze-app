import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db/client";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { fxRepo } from "@/lib/repos/fx-repo";
import { rateFromInteger } from "@/lib/fx/rate";
import { saveDraftAsTransaction } from "@/features/capture/save-transaction";
import type { AccountRow, HouseholdRow } from "@/lib/db/schema";
import type { CaptureDraft } from "@/stores/capture-draft-store";
import { updateTransactionFromDraft } from "./update-transaction";

const HOUSEHOLD_UYU: HouseholdRow = {
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
};

function baseDraft(overrides: Partial<CaptureDraft> = {}): CaptureDraft {
  return {
    kind: "expense",
    amountExpression: "500",
    currency: "",
    accountId: null,
    counterAccountId: null,
    counterFxRateOverride: null,
    captureFxRateOverride: null,
    amountPinnedTo: "account",
    categoryId: "cat-1",
    occurredAt: "2026-07-27T12:00:00.000Z",
    payeeName: "",
    note: "",
    tagIds: [],
    burstMode: false,
    burstCount: 0,
    ...overrides,
  };
}

async function makeArsAccount(): Promise<AccountRow> {
  return accountsRepo.create({
    householdId: HOUSEHOLD_UYU.id,
    ownerId: "user-1",
    name: "Cuenta ARS",
    kind: "wallet",
    institutionId: null,
    countryCode: "AR",
    currencyCode: "ARS",
    openingBalance: 0n,
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
  });
}

describe("updateTransactionFromDraft", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-update-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("A4 — congela fx_rate ya resuelto: editar la nota no lo toca aunque la cotización cambie", async () => {
    const account = await makeArsAccount();
    await fxRepo.setManualOverride(HOUSEHOLD_UYU.id, "ARS", "UYU", rateFromInteger(10));
    const tx = await saveDraftAsTransaction({ draft: baseDraft(), household: HOUSEHOLD_UYU, userId: "user-1", account });
    expect(tx.fxRate).not.toBeNull();
    const frozenRate = tx.fxRate;
    const frozenAmountBase = tx.amountBase;

    // La cotización "de hoy" cambia — un rate congelado no debería enterarse.
    await fxRepo.setManualOverride(HOUSEHOLD_UYU.id, "ARS", "UYU", rateFromInteger(999));

    const updated = await updateTransactionFromDraft({
      transactionId: tx.id,
      draft: baseDraft({ note: "nota nueva" }),
      household: HOUSEHOLD_UYU,
      account,
      existing: tx,
    });

    expect(updated.note).toBe("nota nueva");
    expect(updated.fxRate).toBe(frozenRate);
    expect(updated.amountBase).toBe(frozenAmountBase);
  });

  it("editar el monto arrastra amount_base con la MISMA tasa congelada", async () => {
    // El bug: la fila mostraba el monto nuevo y todos los agregados —total
    // del día, patrimonio, presupuestos— seguían sumando el `amount_base`
    // viejo. Invisible salvo que alguien sumara las filas a mano.
    const account = await makeArsAccount();
    await fxRepo.setManualOverride(HOUSEHOLD_UYU.id, "ARS", "UYU", rateFromInteger(10));
    const tx = await saveDraftAsTransaction({ draft: baseDraft({ amountExpression: "100" }), household: HOUSEHOLD_UYU, userId: "user-1", account });
    const frozenRate = tx.fxRate;
    expect(tx.amountBase).toBe(tx.amount * 10n);

    // La cotización de hoy cambia: no tiene que influir en nada.
    await fxRepo.setManualOverride(HOUSEHOLD_UYU.id, "ARS", "UYU", rateFromInteger(999));

    const updated = await updateTransactionFromDraft({
      transactionId: tx.id,
      draft: baseDraft({ amountExpression: "250" }),
      household: HOUSEHOLD_UYU,
      account,
      existing: tx,
    });

    expect(updated.amount).toBe(25_000n);
    // La tasa NO se movió...
    expect(updated.fxRate).toBe(frozenRate);
    // ...pero el derivado sí siguió al monto, con esa misma tasa.
    expect(updated.amountBase).toBe(25_000n * 10n);
  });

  it("A4 — un rate pending sí se recalcula si el monto cambió de verdad", async () => {
    const account = await makeArsAccount();
    // Sin ningún rate cargado: la transacción nace pending.
    const tx = await saveDraftAsTransaction({ draft: baseDraft(), household: HOUSEHOLD_UYU, userId: "user-1", account });
    expect(tx.fxRate).toBeNull();
    expect(tx.fxSource).toBe("pending");

    await fxRepo.setManualOverride(HOUSEHOLD_UYU.id, "ARS", "UYU", rateFromInteger(10));

    const updated = await updateTransactionFromDraft({
      transactionId: tx.id,
      draft: baseDraft({ amountExpression: "700" }), // monto distinto → dispara el recálculo
      household: HOUSEHOLD_UYU,
      account,
      existing: tx,
    });

    expect(updated.amount).toBe(70_000n);
    expect(updated.fxRate).not.toBeNull();
    expect(updated.fxSource).toBe("manual");
  });

  it("A4 — un rate pending NO se recalcula si nada de lo que lo determina cambió", async () => {
    const account = await makeArsAccount();
    const tx = await saveDraftAsTransaction({ draft: baseDraft(), household: HOUSEHOLD_UYU, userId: "user-1", account });
    expect(tx.fxRate).toBeNull();

    // Aparece un rate recién ahora, pero la edición no toca monto/cuenta/moneda.
    await fxRepo.setManualOverride(HOUSEHOLD_UYU.id, "ARS", "UYU", rateFromInteger(10));

    const updated = await updateTransactionFromDraft({
      transactionId: tx.id,
      draft: baseDraft({ note: "solo la nota" }),
      household: HOUSEHOLD_UYU,
      account,
      existing: tx,
    });

    expect(updated.fxRate).toBeNull();
    expect(updated.fxSource).toBe("pending");
  });

  it("A3 — editar sin cotización de captura tampoco reinterpreta el número tipeado", async () => {
    const account = await makeArsAccount();
    const tx = await saveDraftAsTransaction({ draft: baseDraft(), household: HOUSEHOLD_UYU, userId: "user-1", account });

    const updated = await updateTransactionFromDraft({
      transactionId: tx.id,
      draft: baseDraft({ amountExpression: "100", currency: "USD" }),
      household: HOUSEHOLD_UYU,
      account,
      existing: tx,
    });

    expect(updated.amount).toBe(0n); // nunca 10000n
    expect(updated.originalAmount).toBe(10_000n);
    expect(updated.originalCurrency).toBe("USD");
    expect(updated.originalRate).toBeNull();
  });
});
