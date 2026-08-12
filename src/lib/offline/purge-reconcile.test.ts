import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import { purgeAppliedKeyFor, reconcileRemotePurge } from "./purge-reconcile";

const HOUSEHOLD = "hh-1";

describe("reconcileRemotePurge", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-purge-reconcile-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("no hace nada si purgedAt es null — nunca se corrió un purge remoto", async () => {
    const db = getDb();
    await db.accounts.add({ id: "acc-1", householdId: HOUSEHOLD, visibility: "household" } as never);

    const cleaned = await reconcileRemotePurge(HOUSEHOLD, null);

    expect(cleaned).toBe(false);
    expect(await db.accounts.where("householdId").equals(HOUSEHOLD).count()).toBe(1);
  });

  it("limpia Dexie y guarda el marcador cuando purgedAt es más nuevo que lo ya aplicado", async () => {
    const db = getDb();
    await db.accounts.add({ id: "acc-1", householdId: HOUSEHOLD, visibility: "household" } as never);
    await db.meta.put({ key: purgeAppliedKeyFor(HOUSEHOLD), value: "2026-08-01T00:00:00.000Z" });

    const cleaned = await reconcileRemotePurge(HOUSEHOLD, "2026-08-10T00:00:00.000Z");

    expect(cleaned).toBe(true);
    expect(await db.accounts.where("householdId").equals(HOUSEHOLD).count()).toBe(0);
    expect((await db.meta.get(purgeAppliedKeyFor(HOUSEHOLD)))?.value).toBe("2026-08-10T00:00:00.000Z");
  });

  it("no vuelve a limpiar si el marcador ya está al día — mismo dispositivo que ejecutó el purge", async () => {
    const db = getDb();
    await db.meta.put({ key: purgeAppliedKeyFor(HOUSEHOLD), value: "2026-08-10T00:00:00.000Z" });
    // Datos cargados DESPUÉS del purge — no tienen que desaparecer.
    await db.accounts.add({ id: "acc-nuevo", householdId: HOUSEHOLD, visibility: "household" } as never);

    const cleaned = await reconcileRemotePurge(HOUSEHOLD, "2026-08-10T00:00:00.000Z");

    expect(cleaned).toBe(false);
    expect(await db.accounts.where("householdId").equals(HOUSEHOLD).count()).toBe(1);
  });

  it("no toca Dexie de un household distinto", async () => {
    const db = getDb();
    await db.accounts.add({ id: "acc-other", householdId: "hh-2", visibility: "household" } as never);

    await reconcileRemotePurge(HOUSEHOLD, "2026-08-10T00:00:00.000Z");

    expect(await db.accounts.where("householdId").equals("hh-2").count()).toBe(1);
  });
});
