// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db/client";
import { fxRepo } from "@/lib/repos/fx-repo";
import type { AccountRow, TransactionRow } from "@/lib/db/schema";
import { useTrackedCurrencies } from "./use-tracked-currencies";

// Mismo mock que `fx-repo.test.ts`: `setManualOverride`/`setPreference`
// también hablan con Supabase — sin esto, esta suite golpearía el proyecto
// real con la anon key de `.env.local`.
function fakeQueryBuilder(): PromiseLike<{ data: null; error: null }> & Record<string, unknown> {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    order: () => builder,
    update: () => builder,
    insert: () => builder,
    upsert: () => builder,
    returns: () => builder,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: (value: { data: null; error: null }) => void) => resolve({ data: null, error: null }),
  };
  return builder as never;
}
vi.mock("../lib/supabase/client", () => ({ createClient: () => ({ from: () => fakeQueryBuilder() }) }));

const HOUSEHOLD = "hh-1";

function account(id: string, currencyCode: string, extra: Partial<AccountRow> = {}): AccountRow {
  return {
    id,
    householdId: HOUSEHOLD,
    ownerId: "user-1",
    name: id,
    kind: "checking",
    institutionId: null,
    countryCode: null,
    currencyCode,
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
    sortOrder: 0,
    archivedAt: null,
    createdBy: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    clientRev: 1,
    ...extra,
  };
}

function render(accounts: AccountRow[], transactions: TransactionRow[] | undefined, baseCurrency = "UYU") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useTrackedCurrencies(HOUSEHOLD, baseCurrency, accounts, transactions), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

describe("useTrackedCurrencies", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-tracked-currencies-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("incluye la moneda base aunque nadie la use todavía", async () => {
    const { result } = render([], undefined);
    await waitFor(() => expect(result.current.currencies).toEqual(["UYU"]));
  });

  it("incluye monedas de cuentas activas, no de archivadas", async () => {
    const accounts = [account("a", "USD"), account("b", "ARS", { archivedAt: "2026-01-01T00:00:00.000Z" })];
    const { result } = render(accounts, []);
    await waitFor(() => expect(result.current.currencies).toEqual(["USD", "UYU"]));
  });

  // No hay un test directo del caso "solo override manual, sin cuenta":
  // `listOverrideCurrencies` usa un `.between()` sobre un índice compuesto
  // que tira `DataError` bajo `fake-indexeddb` (documentado en el propio
  // comentario de `fxRepo.listOverrideCurrencies`, `fx-repo.ts`) — mismo
  // límite que ya documenta `fx-repo.test.ts`. El caso D32 sin override
  // (solo preferencia) sí se puede probar acá y cubre el mismo mecanismo.
  it("una moneda con solo preferencia (sin override, sin cuenta) aparece igual — D32", async () => {
    await fxRepo.setPreference(HOUSEHOLD, "EUR/UYU", "manual", "custom");
    const { result } = render([], []);
    await waitFor(() => expect(result.current.currencies).toContain("EUR"));
  });

  it("incluye monedas vistas en movimientos, aunque ninguna cuenta las tenga", async () => {
    const tx = { currencyCode: "GBP", originalCurrency: null } as Pick<TransactionRow, "currencyCode" | "originalCurrency"> as TransactionRow;
    const { result } = render([], [tx]);
    await waitFor(() => expect(result.current.currencies).toContain("GBP"));
  });
});
