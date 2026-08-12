import { describe, expect, it } from "vitest";
import type { AccountRow } from "@/lib/db/schema";
import { compareAccountsForDisplay } from "./account-order";

function account(overrides: Partial<AccountRow> & Pick<AccountRow, "id" | "name" | "currencyCode" | "sortOrder">): AccountRow {
  return {
    householdId: "hh-1",
    ownerId: "profile-1",
    kind: "checking",
    institutionId: null,
    countryCode: null,
    openingBalance: 0n,
    openingDate: null,
    currentBalance: 0n,
    creditLimit: null,
    statementDay: null,
    dueDay: null,
    accountGroupId: null,
    interestRate: null,
    termMonths: null,
    includeInNetWorth: true,
    visibility: "household",
    color: null,
    icon: null,
    archivedAt: null,
    createdBy: "profile-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    clientRev: 1,
    ...overrides,
  };
}

describe("compareAccountsForDisplay", () => {
  it("la moneda base va primero, aunque alfabéticamente vaya después", () => {
    const usd = account({ id: "1", name: "Cocos", currencyCode: "USD", sortOrder: 0 });
    const ars = account({ id: "2", name: "Mercado Pago", currencyCode: "ARS", sortOrder: 0 });
    const sorted = [ars, usd].sort(compareAccountsForDisplay("USD"));
    expect(sorted.map((a) => a.id)).toEqual(["1", "2"]);
  });

  it("monedas que no son la base se ordenan alfabéticamente entre sí", () => {
    const uyu = account({ id: "1", name: "Itaú", currencyCode: "UYU", sortOrder: 0 });
    const ars = account({ id: "2", name: "Mercado Pago", currencyCode: "ARS", sortOrder: 0 });
    const sorted = [uyu, ars].sort(compareAccountsForDisplay("USD"));
    expect(sorted.map((a) => a.id)).toEqual(["2", "1"]); // ARS < UYU
  });

  it("dentro de la misma moneda, respeta sortOrder — el orden que el usuario define con drag&drop", () => {
    const first = account({ id: "1", name: "Cocos", currencyCode: "USD", sortOrder: 2 });
    const second = account({ id: "2", name: "BBVA", currencyCode: "USD", sortOrder: 0 });
    const third = account({ id: "3", name: "Itaú", currencyCode: "USD", sortOrder: 1 });
    const sorted = [first, second, third].sort(compareAccountsForDisplay("USD"));
    expect(sorted.map((a) => a.id)).toEqual(["2", "3", "1"]);
  });

  it("sortOrder empatado desempata por nombre — nunca queda en un orden arbitrario", () => {
    const b = account({ id: "1", name: "Banco B", currencyCode: "USD", sortOrder: 0 });
    const a = account({ id: "2", name: "Banco A", currencyCode: "USD", sortOrder: 0 });
    const sorted = [b, a].sort(compareAccountsForDisplay("USD"));
    expect(sorted.map((a) => a.id)).toEqual(["2", "1"]);
  });

  it("sortOrder de un grupo de moneda no se compara contra el de otro — el corte de moneda va primero", () => {
    // Reproduce el caso real: reorderAccounts reinicia sortOrder en 0 por
    // cada grupo, así que una cuenta ARS con sortOrder=0 y una USD con
    // sortOrder=0 no deberían "empatar" — el grupo de moneda decide antes
    // de mirar sortOrder.
    const arsFirst = account({ id: "1", name: "Mercado Pago", currencyCode: "ARS", sortOrder: 0 });
    const usdSecond = account({ id: "2", name: "Cocos", currencyCode: "USD", sortOrder: 1 });
    const sorted = [arsFirst, usdSecond].sort(compareAccountsForDisplay("USD"));
    expect(sorted.map((a) => a.id)).toEqual(["2", "1"]);
  });
});
