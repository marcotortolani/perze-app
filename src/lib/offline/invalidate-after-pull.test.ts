import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateAfterPull } from "./invalidate-after-pull";
import type { PullResult } from "./pull";

const EMPTY_RESULT: PullResult = {
  transactions: 0,
  accounts: 3,
  accountGroups: 0,
  categories: 5,
  tags: 0,
  payees: 0,
  budgets: 1,
  goals: 0,
  recurringRules: 0,
  rules: 0,
  members: 1,
  trades: 0,
  prunedTotal: 0,
};

function seedClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const seed = (key: unknown[]) => client.setQueryData(key, "x");
  seed(["household", "current"]);
  seed(["auth", "user"]);
  seed(["auth", "own-access", "u1"]);
  seed(["asset-classes"]);
  seed(["portfolios", "h1"]);
  seed(["trades", "p1"]);
  seed(["instruments", "h1"]);
  seed(["transactions", "h1", {}]);
  seed(["accounts", "h1"]);
  seed(["net-worth", "h1", "UYU"]);
  seed(["conflicts", "h1"]);
  return client;
}

function isStale(client: QueryClient, key: unknown[]): boolean {
  return client.getQueryState(key)?.isInvalidated ?? false;
}

describe("invalidateAfterPull", () => {
  it("no invalida nada cuando el pull no trajo transacciones nuevas ni borrados (el caso normal)", () => {
    const client = seedClient();
    invalidateAfterPull(client, EMPTY_RESULT);

    expect(isStale(client, ["transactions", "h1", {}])).toBe(false);
    expect(isStale(client, ["accounts", "h1"])).toBe(false);
    expect(isStale(client, ["net-worth", "h1", "UYU"])).toBe(false);
  });

  it("invalida el resto del cache cuando hay transacciones nuevas", () => {
    const client = seedClient();
    invalidateAfterPull(client, { ...EMPTY_RESULT, transactions: 2 });

    expect(isStale(client, ["transactions", "h1", {}])).toBe(true);
    expect(isStale(client, ["accounts", "h1"])).toBe(true);
    expect(isStale(client, ["net-worth", "h1", "UYU"])).toBe(true);
    expect(isStale(client, ["conflicts", "h1"])).toBe(true);
    // Auditoría de outbox de inversiones — `trades` ya no está en
    // `NEVER_TOUCHED_BY_PULL`: `pullFromRemote` la sincroniza como al resto.
    expect(isStale(client, ["trades", "p1"])).toBe(true);
  });

  it("invalida el resto del cache cuando el pull detectó borrados aunque no haya transacciones nuevas", () => {
    const client = seedClient();
    invalidateAfterPull(client, { ...EMPTY_RESULT, prunedTotal: 1 });

    expect(isStale(client, ["accounts", "h1"])).toBe(true);
  });

  it("nunca invalida lo que `pullFromRemote` no toca, ni siquiera cuando hubo cambios", () => {
    const client = seedClient();
    invalidateAfterPull(client, { ...EMPTY_RESULT, transactions: 2 });

    expect(isStale(client, ["household", "current"])).toBe(false);
    expect(isStale(client, ["auth", "user"])).toBe(false);
    expect(isStale(client, ["auth", "own-access", "u1"])).toBe(false);
    expect(isStale(client, ["asset-classes"])).toBe(false);
    expect(isStale(client, ["portfolios", "h1"])).toBe(false);
    expect(isStale(client, ["instruments", "h1"])).toBe(false);
  });
});
