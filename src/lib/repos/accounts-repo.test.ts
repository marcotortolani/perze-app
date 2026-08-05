import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import { outbox } from "../offline/outbox";
import { accountsRepo } from "./accounts-repo";
import type { AccountRow } from "../db/schema";

const HOUSEHOLD = "hh-1";
const USER = "user-1";

function account(overrides: Partial<AccountRow> = {}): AccountRow {
  return {
    id: "a-1",
    householdId: HOUSEHOLD,
    ownerId: USER,
    name: "Itaú",
    kind: "checking",
    institutionId: null,
    countryCode: "UY",
    currencyCode: "UYU",
    openingBalance: 0n,
    openingDate: null,
    currentBalance: 0n,
    creditLimit: null,
    statementDay: null,
    dueDay: null,
    interestRate: null,
    termMonths: null,
    includeInNetWorth: true,
    visibility: "household",
    color: null,
    icon: null,
    sortOrder: 0,
    archivedAt: null,
    createdBy: USER,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    clientRev: 1,
    ...overrides,
  };
}

/**
 * Regresión de un bug silencioso encontrado auditando las rutas
 * interceptoras (`docs/auditoria-rutas-interceptoras.md` § 6):
 * `enqueueAccountUpdate` hacía `if (!existing) return;`, así que archivar una
 * cuenta que no estaba en Dexie resolvía con ÉXITO sin escribir ni encolar
 * nada. La UI mostraba el toast de "archivada" y no pasaba absolutamente
 * nada, sin rastro en ningún lado.
 */
describe("accountsRepo — una escritura sobre una fila que no está no puede fallar en silencio", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-accounts-repo-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  for (const [label, run] of [
    ["archive", () => accountsRepo.archive("no-existe")],
    ["unarchive", () => accountsRepo.unarchive("no-existe")],
    ["update", () => accountsRepo.update("no-existe", { name: "Otro" })],
    ["softDelete", () => accountsRepo.softDelete("no-existe")],
  ] as const) {
    it(`${label}() lanza en vez de resolver sin hacer nada`, async () => {
      await expect(run()).rejects.toThrow(/no encontrada/);
    });
  }

  it("no deja nada en el outbox cuando la fila no está", async () => {
    await expect(accountsRepo.archive("no-existe")).rejects.toThrow();
    expect(await outbox.listAll()).toHaveLength(0);
  });

  it("sobre una fila que sí está, archive escribe y encola con el clientRev incrementado", async () => {
    await getDb().accounts.put(account());
    await accountsRepo.archive("a-1");

    const stored = await getDb().accounts.get("a-1");
    expect(stored?.archivedAt).not.toBeNull();
    expect(stored?.clientRev).toBe(2);

    const queued = await outbox.listAll();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ table: "accounts", op: "update", entityId: "a-1", clientRev: 2 });
  });
});
