import { describe, expect, it, vi } from "vitest";

// `hydrate.ts` importa el cliente de Supabase (que valida `@/env` al cargar)
// — acá solo se testean los mappers puros, así que se cortocircuita.
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

import { accountFromRow, categoryFromRow, householdFromRow, memberFromRow, payeeFromRow, transactionFromRow, type RawAccount, type RawTransaction } from "./hydrate";

/**
 * AC-1 (`docs/auditoria-acceso.md`) — los mappers de hidratación son la
 * contracara de `sync-config.ts` y cargan las mismas reglas de dinero:
 * bigint desde `::text` (nunca number), rates por `parseRate`, y NULL de
 * FX preservado como needs_fx legítimo.
 */

const RAW_ACCOUNT: RawAccount = {
  id: "a1",
  household_id: "h1",
  owner_id: "u1",
  name: "Efectivo",
  kind: "cash",
  institution_id: null,
  country_code: "UY",
  currency_code: "UYU",
  opening_balance: "150000",
  opening_date: "2026-01-01",
  current_balance: "9007199254740993", // 2^53 + 1: imposible de representar como number
  credit_limit: null,
  statement_day: null,
  due_day: null,
  interest_rate: null,
  term_months: null,
  include_in_net_worth: true,
  visibility: "household",
  color: null,
  icon: null,
  sort_order: null,
  archived_at: null,
  created_by: "u1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
  client_rev: 3,
};

describe("accountFromRow", () => {
  it("parsea los montos como bigint sin perder precisión arriba de 2^53", () => {
    const row = accountFromRow(RAW_ACCOUNT);
    expect(row.currentBalance).toBe(9007199254740993n);
    expect(row.openingBalance).toBe(150000n);
    expect(row.creditLimit).toBeNull();
    expect(row.sortOrder).toBe(0); // sort_order NULL en PG → 0 local
  });

  it("rechaza un monto que llegue como number (select sin ::text)", () => {
    expect(() => accountFromRow({ ...RAW_ACCOUNT, opening_balance: 150000 as unknown as string })).toThrow();
  });
});

const RAW_TX: RawTransaction = {
  id: "t1",
  household_id: "h1",
  created_by: "u1",
  kind: "expense",
  occurred_at: "2026-07-01T12:00:00Z",
  account_id: "a1",
  counter_account_id: null,
  amount: "-4500",
  currency_code: "USD",
  original_amount: null,
  original_currency: null,
  original_rate: null,
  fx_rate: null,
  fx_source: "pending",
  fx_provider: null,
  fx_quote_kind: null,
  fx_resolved_at: null,
  amount_base: null,
  counter_amount: null,
  counter_currency_code: null,
  counter_fx_rate: null,
  category_id: "c1",
  payee_id: null,
  note: null,
  attachments: [],
  location: null,
  status: "cleared",
  visibility: "household",
  recurring_id: null,
  installment_group_id: null,
  installment_number: null,
  installment_total: null,
  created_at: "2026-07-01T12:00:00Z",
  updated_at: "2026-07-01T12:00:00Z",
  deleted_at: null,
  client_rev: 1,
  source: "manual",
};

describe("transactionFromRow", () => {
  it("preserva un needs_fx legítimo: fxRate y amountBase quedan NULL, nunca un 1 inventado", () => {
    const row = transactionFromRow(RAW_TX);
    expect(row.fxRate).toBeNull();
    expect(row.amountBase).toBeNull();
    expect(row.fxSource).toBe("pending");
    expect(row.amount).toBe(-4500n);
  });

  it("parsea los rates con parseRate (ScaledRate ×10¹²), nunca parseFloat", () => {
    const row = transactionFromRow({ ...RAW_TX, fx_rate: "40.250000000000", fx_source: "api", amount_base: "-181125" });
    expect(row.fxRate).toBe(40_250_000_000_000n);
    expect(row.amountBase).toBe(-181125n);
  });

  it("la fila hidratada nace con syncState ok — existe en el servidor por definición", () => {
    expect(transactionFromRow(RAW_TX).syncState).toBe("ok");
    expect(transactionFromRow(RAW_TX).syncError).toBeNull();
  });
});

describe("categoryFromRow", () => {
  const base = {
    id: "c1",
    household_id: "h1",
    parent_id: null,
    icon: null,
    color: null,
    kind: "expense",
    nature: "variable",
    is_system: true,
    sort_order: 2,
    archived_at: null,
    visibility: "household",
    owner_id: null,
    created_by: "u1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    client_rev: 1,
  };

  it("reconstruye i18nKey por nombre para las categorías de plantilla", () => {
    expect(categoryFromRow({ ...base, name: "Supermercado" }).i18nKey).toBe("groceries");
  });

  it("deja i18nKey en null para categorías renombradas o propias", () => {
    expect(categoryFromRow({ ...base, name: "Gastos del gato" }).i18nKey).toBeNull();
  });
});

describe("householdFromRow / memberFromRow / payeeFromRow", () => {
  it("coalesce de los nullable de PG que el schema local exige no-nulos", () => {
    const h = householdFromRow({
      id: "h1",
      name: "Mi hogar",
      base_currency: "UYU",
      base_country: "UY",
      period_start_day: 1,
      week_start: 1,
      enabled_modules: ["family"],
      settings: null,
      created_by: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      client_rev: 1,
    });
    expect(h.settings).toEqual({});
    expect(h.createdBy).toBe("");
    expect(h.enabledModules).toEqual(["family"]);

    const m = memberFromRow({ household_id: "h1", profile_id: "u1", role: "owner", display_name: null, color: null, status: "active", joined_at: null });
    expect(m.displayName).toBe("");
    expect(m.color).toBe("var(--primary-fill)");
    expect(typeof m.joinedAt).toBe("string");

    const p = payeeFromRow({ id: "p1", household_id: "h1", name: "Devoto", default_category_id: null, default_account_id: null, logo_url: null, aliases: null, client_rev: 1 });
    expect(p.aliases).toEqual([]);
  });
});
