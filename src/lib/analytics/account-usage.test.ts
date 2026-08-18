import { describe, expect, it } from "vitest";
import { countAccountUsage, lastUsedAccount, rankAccountsByUsage, rankRecentAccountsByUsage } from "./account-usage";
import type { AccountRow, TransactionRow } from "@/lib/db/schema";

type Tx = Pick<TransactionRow, "accountId" | "createdAt">;

function tx(accountId: string, createdAt: string): Tx {
  return { accountId, createdAt };
}

function account(id: string, sortOrder: number, extra: Partial<AccountRow> = {}): AccountRow {
  return {
    id,
    householdId: "hh-1",
    ownerId: "user-1",
    name: id,
    kind: "checking",
    institutionId: null,
    countryCode: null,
    currencyCode: "UYU",
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
    sortOrder,
    archivedAt: null,
    createdBy: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    clientRev: 1,
    ...extra,
  };
}

describe("countAccountUsage", () => {
  it("cuenta ocurrencias por cuenta", () => {
    const usage = countAccountUsage([tx("a", "2026-07-01T00:00:00.000Z"), tx("a", "2026-07-02T00:00:00.000Z"), tx("b", "2026-07-01T00:00:00.000Z")]);
    expect(usage[0]).toMatchObject({ accountId: "a", count: 2 });
  });

  it("a igual conteo, desempata por creación más reciente", () => {
    const usage = countAccountUsage([tx("a", "2026-01-01T00:00:00.000Z"), tx("b", "2026-07-10T00:00:00.000Z")]);
    expect(usage.map((u) => u.accountId)).toEqual(["b", "a"]);
  });

  it("respeta `since`", () => {
    const usage = countAccountUsage([tx("a", "2026-01-01T00:00:00.000Z"), tx("a", "2026-07-01T00:00:00.000Z")], { since: "2026-06-01T00:00:00.000Z" });
    expect(usage[0]).toMatchObject({ count: 1 });
  });
});

describe("rankAccountsByUsage", () => {
  it("excluye cuentas archivadas", () => {
    const accounts = [account("a", 0), account("b", 1, { archivedAt: "2026-01-01T00:00:00.000Z" })];
    const ranked = rankAccountsByUsage(accounts, [{ accountId: "b", count: 5, lastCreatedAt: "2026-07-01T00:00:00.000Z" }], { limit: 5 });
    expect(ranked.map((a) => a.id)).toEqual(["a"]);
  });

  it("rellena por sortOrder cuando no hay suficiente uso", () => {
    const accounts = [account("a", 1), account("b", 0)];
    const ranked = rankAccountsByUsage(accounts, [], { limit: 5 });
    expect(ranked.map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("prioriza uso real sobre sortOrder", () => {
    const accounts = [account("a", 0), account("b", 1)];
    const ranked = rankAccountsByUsage(accounts, [{ accountId: "b", count: 3, lastCreatedAt: "2026-07-01T00:00:00.000Z" }], { limit: 1 });
    expect(ranked.map((a) => a.id)).toEqual(["b"]);
  });
});

describe("rankRecentAccountsByUsage", () => {
  it("cae a histórico completo cuando la ventana de 90 días no alcanza para llenar `limit`", () => {
    const accounts = [account("a", 0), account("b", 1)];
    const now = new Date("2026-08-18T00:00:00.000Z");
    const oldTx = [tx("a", "2026-01-01T00:00:00.000Z")]; // fuera de la ventana de 90 días
    const ranked = rankRecentAccountsByUsage(accounts, oldTx, { limit: 2, now });
    expect(ranked.map((a) => a.id)).toContain("a");
    expect(ranked).toHaveLength(2);
  });
});

describe("lastUsedAccount", () => {
  it("elige la cuenta del movimiento con createdAt más reciente, no occurredAt", () => {
    const accounts = [account("a", 0), account("b", 1)];
    // "b" es el último CARGADO aunque su fecha de ocurrencia sea vieja.
    const txs = [tx("a", "2026-07-01T00:00:00.000Z"), tx("b", "2026-07-15T00:00:00.000Z")];
    expect(lastUsedAccount(accounts, txs)?.id).toBe("b");
  });

  it("ignora una cuenta archivada y cae a la primera activa por sortOrder", () => {
    const accounts = [account("a", 1), account("b", 0, { archivedAt: "2026-01-01T00:00:00.000Z" })];
    const txs = [tx("b", "2026-07-15T00:00:00.000Z")];
    expect(lastUsedAccount(accounts, txs)?.id).toBe("a");
  });

  it("sin movimientos, cae a la primera cuenta activa por sortOrder", () => {
    const accounts = [account("a", 1), account("b", 0)];
    expect(lastUsedAccount(accounts, [])?.id).toBe("b");
  });

  it("sin cuentas activas, devuelve undefined", () => {
    expect(lastUsedAccount([], [])).toBeUndefined();
  });
});
