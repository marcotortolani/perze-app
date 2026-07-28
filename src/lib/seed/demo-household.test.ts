import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import { accountsRepo } from "../repos/accounts-repo";
import { transactionsRepo } from "../repos/transactions-repo";
import { seedDemoHousehold } from "./demo-household";

describe("seedDemoHousehold", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-seed-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("crea un household completo sin errores", async () => {
    const { householdId } = await seedDemoHousehold();
    expect(householdId).toBeTruthy();

    const accounts = await accountsRepo.list(householdId);
    expect(accounts.length).toBe(5);

    const transactions = await transactionsRepo.list(householdId);
    // 34 gastos + sueldo + gasto USD + gasto ARS + transferencia
    expect(transactions.length).toBe(38);
  });

  it("todas las cuentas tienen saldo consistente (ninguna quedó en NaN/undefined)", async () => {
    const { householdId } = await seedDemoHousehold();
    const accounts = await accountsRepo.list(householdId);
    for (const account of accounts) {
      expect(typeof account.currentBalance).toBe("bigint");
    }
  });

  it("incluye al menos un movimiento needs_fx", async () => {
    const { householdId } = await seedDemoHousehold();
    const pending = await transactionsRepo.listNeedingFx(householdId);
    expect(pending.length).toBeGreaterThanOrEqual(1);
  });
});
