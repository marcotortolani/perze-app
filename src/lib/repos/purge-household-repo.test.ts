import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import { purgeAppliedKeyFor } from "../offline/purge-reconcile";

// `finishPurge` habla con Supabase vía `rpc("purge_household_finish", ...)`.
// El fake devuelve lo que cada test declare en `mocks.result`, para poder
// simular tanto el éxito (data = el `purged_at` que devolvería el server)
// como el fallo (error) que este archivo existe para hacer recuperable.
const mocks = vi.hoisted(() => ({ result: { data: null as string | null, error: null as Error | null }, calls: 0 }));
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    rpc: async () => {
      mocks.calls++;
      return mocks.result;
    },
  }),
}));

const { finishPurge, markPurgeFinishPending, pendingPurgeFinishKeyFor, retryPendingPurgeFinish } = await import(
  "./purge-household-repo"
);

const HOUSEHOLD = "hh-1";

describe("finishPurge / retryPendingPurgeFinish — v0.30.25", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-purge-finish-${crypto.randomUUID()}`);
    mocks.result = { data: null, error: null };
    mocks.calls = 0;
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("finishPurge exitoso guarda el marcador de purgeApplied con el purged_at del servidor y limpia el pendiente", async () => {
    mocks.result = { data: "2026-08-12T00:00:00.000Z", error: null };
    await markPurgeFinishPending(HOUSEHOLD);

    await finishPurge(HOUSEHOLD);

    expect((await getDb().meta.get(purgeAppliedKeyFor(HOUSEHOLD)))?.value).toBe("2026-08-12T00:00:00.000Z");
    expect(await getDb().meta.get(pendingPurgeFinishKeyFor(HOUSEHOLD))).toBeUndefined();
  });

  it("finishPurge que falla sigue tirando (no lo swallowea acá — eso lo decide el caller)", async () => {
    mocks.result = { data: null, error: new Error("network down") };

    await expect(finishPurge(HOUSEHOLD)).rejects.toThrow("network down");
  });

  it("retryPendingPurgeFinish no llama a la red si no hay marcador pendiente", async () => {
    await retryPendingPurgeFinish(HOUSEHOLD);
    expect(mocks.calls).toBe(0);
  });

  it("retryPendingPurgeFinish reintenta y limpia el marcador cuando el servidor responde bien", async () => {
    mocks.result = { data: "2026-08-12T03:00:00.000Z", error: null };
    await markPurgeFinishPending(HOUSEHOLD);

    await retryPendingPurgeFinish(HOUSEHOLD);

    expect(mocks.calls).toBe(1);
    expect((await getDb().meta.get(purgeAppliedKeyFor(HOUSEHOLD)))?.value).toBe("2026-08-12T03:00:00.000Z");
    expect(await getDb().meta.get(pendingPurgeFinishKeyFor(HOUSEHOLD))).toBeUndefined();
  });

  it("retryPendingPurgeFinish deja el marcador puesto si vuelve a fallar, para el próximo tick", async () => {
    mocks.result = { data: null, error: new Error("still down") };
    await markPurgeFinishPending(HOUSEHOLD);

    await expect(retryPendingPurgeFinish(HOUSEHOLD)).rejects.toThrow("still down");

    expect(await getDb().meta.get(pendingPurgeFinishKeyFor(HOUSEHOLD))).toBeDefined();
  });
});
