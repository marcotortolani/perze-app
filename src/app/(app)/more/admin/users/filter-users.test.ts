import { describe, expect, it } from "vitest";
import type { AccessRequest } from "@/lib/repos/admin-repo";
import { countPending, countriesOf, DEFAULT_CRITERIA, filterAndSortUsers, isDefaultCriteria, type UsersCriteria } from "./filter-users";

function user(overrides: Partial<AccessRequest> & Pick<AccessRequest, "profileId">): AccessRequest {
  return {
    email: null,
    displayName: null,
    country: null,
    accessStatus: "approved",
    accessRequestedAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: null,
    isAppAdmin: false,
    ...overrides,
  };
}

function criteria(overrides: Partial<UsersCriteria> = {}): UsersCriteria {
  return { ...DEFAULT_CRITERIA, ...overrides };
}

describe("filterAndSortUsers — búsqueda", () => {
  it("query vacía devuelve todos, en el orden pedido", () => {
    const a = user({ profileId: "1", accessRequestedAt: "2026-01-01T00:00:00.000Z" });
    const b = user({ profileId: "2", accessRequestedAt: "2026-01-02T00:00:00.000Z" });
    const result = filterAndSortUsers([a, b], criteria());
    expect(result.map((u) => u.profileId)).toEqual(["2", "1"]); // requestedAt desc por default
  });

  it("matchea acento-insensible y case-insensible por nombre", () => {
    const target = user({ profileId: "1", displayName: "Valentina Méndez" });
    const other = user({ profileId: "2", displayName: "Juan Pérez" });
    const result = filterAndSortUsers([target, other], criteria({ query: "MENDEZ" }));
    expect(result.map((u) => u.profileId)).toEqual(["1"]);
  });

  it("matchea por email cuando displayName es null", () => {
    const target = user({ profileId: "1", email: "vale.mendez@gmail.com" });
    const result = filterAndSortUsers([target], criteria({ query: "mendez" }));
    expect(result.map((u) => u.profileId)).toEqual(["1"]);
  });

  it("matchea por nombre cuando email es null", () => {
    const target = user({ profileId: "1", displayName: "Valentina Méndez" });
    const result = filterAndSortUsers([target], criteria({ query: "valentina" }));
    expect(result.map((u) => u.profileId)).toEqual(["1"]);
  });

  it("no explota con email y displayName en null", () => {
    const target = user({ profileId: "1" });
    expect(() => filterAndSortUsers([target], criteria({ query: "algo" }))).not.toThrow();
    expect(filterAndSortUsers([target], criteria({ query: "algo" }))).toEqual([]);
  });

  it("query sin match devuelve vacío", () => {
    const target = user({ profileId: "1", email: "vale@gmail.com" });
    expect(filterAndSortUsers([target], criteria({ query: "zzz" }))).toEqual([]);
  });

  it("con query, el score manda por encima del sort elegido", () => {
    // "mendez" matchea exacto contra el nombre de "1" (score alto) y solo
    // por substring contra el email de "2" — aunque "2" sea más nuevo y el
    // sort sea requestedAt desc, "1" tiene que ir primero por score.
    const exact = user({ profileId: "1", displayName: "Mendez", accessRequestedAt: "2026-01-01T00:00:00.000Z" });
    const substring = user({ profileId: "2", email: "algomendezmas@gmail.com", accessRequestedAt: "2026-02-01T00:00:00.000Z" });
    const result = filterAndSortUsers([substring, exact], criteria({ query: "mendez" }));
    expect(result.map((u) => u.profileId)).toEqual(["1", "2"]);
  });
});

describe("filterAndSortUsers — filtros", () => {
  it("status filtra exacto", () => {
    const pending = user({ profileId: "1", accessStatus: "pending" });
    const approved = user({ profileId: "2", accessStatus: "approved" });
    const result = filterAndSortUsers([pending, approved], criteria({ status: "pending" }));
    expect(result.map((u) => u.profileId)).toEqual(["1"]);
  });

  it('status "all" no filtra', () => {
    const pending = user({ profileId: "1", accessStatus: "pending" });
    const approved = user({ profileId: "2", accessStatus: "approved" });
    const result = filterAndSortUsers([pending, approved], criteria({ status: "all" }));
    expect(result).toHaveLength(2);
  });

  it("country filtra por código exacto y no rompe con country: null", () => {
    const uy = user({ profileId: "1", country: "UY" });
    const noCountry = user({ profileId: "2", country: null });
    const result = filterAndSortUsers([uy, noCountry], criteria({ country: "UY" }));
    expect(result.map((u) => u.profileId)).toEqual(["1"]);
  });
});

describe("filterAndSortUsers — orden", () => {
  it("ordena por requestedAt asc/desc", () => {
    const older = user({ profileId: "1", accessRequestedAt: "2026-01-01T00:00:00.000Z" });
    const newer = user({ profileId: "2", accessRequestedAt: "2026-02-01T00:00:00.000Z" });
    expect(filterAndSortUsers([older, newer], criteria({ sort: "requestedAt", dir: "desc" })).map((u) => u.profileId)).toEqual(["2", "1"]);
    expect(filterAndSortUsers([older, newer], criteria({ sort: "requestedAt", dir: "asc" })).map((u) => u.profileId)).toEqual(["1", "2"]);
  });

  it("ordena por name asc/desc con localeCompare", () => {
    const ana = user({ profileId: "1", displayName: "Ana" });
    const beto = user({ profileId: "2", displayName: "Beto" });
    expect(filterAndSortUsers([beto, ana], criteria({ sort: "name", dir: "asc" })).map((u) => u.profileId)).toEqual(["1", "2"]);
    expect(filterAndSortUsers([beto, ana], criteria({ sort: "name", dir: "desc" })).map((u) => u.profileId)).toEqual(["2", "1"]);
  });

  it("lastSeenAt: null va último en desc", () => {
    const seen = user({ profileId: "1", lastSeenAt: "2026-01-01T00:00:00.000Z" });
    const never = user({ profileId: "2", lastSeenAt: null });
    expect(filterAndSortUsers([never, seen], criteria({ sort: "lastSeenAt", dir: "desc" })).map((u) => u.profileId)).toEqual(["1", "2"]);
  });

  it("lastSeenAt: null va último TAMBIÉN en asc (no se coerciona a 0)", () => {
    const seen = user({ profileId: "1", lastSeenAt: "2026-01-01T00:00:00.000Z" });
    const never = user({ profileId: "2", lastSeenAt: null });
    expect(filterAndSortUsers([never, seen], criteria({ sort: "lastSeenAt", dir: "asc" })).map((u) => u.profileId)).toEqual(["1", "2"]);
  });

  it("desempata de forma estable por profileId cuando dos fechas son idénticas", () => {
    const a = user({ profileId: "b", accessRequestedAt: "2026-01-01T00:00:00.000Z" });
    const b = user({ profileId: "a", accessRequestedAt: "2026-01-01T00:00:00.000Z" });
    const result = filterAndSortUsers([a, b], criteria({ sort: "requestedAt", dir: "desc" }));
    expect(result.map((u) => u.profileId)).toEqual(["a", "b"]);
    // Reordenar el array de entrada no debería cambiar el resultado.
    const resultReversed = filterAndSortUsers([b, a], criteria({ sort: "requestedAt", dir: "desc" }));
    expect(resultReversed.map((u) => u.profileId)).toEqual(["a", "b"]);
  });
});

describe("countPending", () => {
  it("cuenta sobre el array completo, sin aplicar otros criterios", () => {
    const pending1 = user({ profileId: "1", accessStatus: "pending" });
    const pending2 = user({ profileId: "2", accessStatus: "pending" });
    const approved = user({ profileId: "3", accessStatus: "approved" });
    expect(countPending([pending1, pending2, approved])).toBe(2);
  });
});

describe("countriesOf", () => {
  it("deduplica, ignora null y ordena alfabéticamente", () => {
    const a = user({ profileId: "1", country: "UY" });
    const b = user({ profileId: "2", country: "AR" });
    const c = user({ profileId: "3", country: "UY" });
    const d = user({ profileId: "4", country: null });
    expect(countriesOf([a, b, c, d])).toEqual(["AR", "UY"]);
  });
});

describe("isDefaultCriteria", () => {
  it("es true para los criterios default", () => {
    expect(isDefaultCriteria(criteria())).toBe(true);
  });

  it("es false si cambia query, status, country, sort o dir, uno por uno", () => {
    expect(isDefaultCriteria(criteria({ query: "algo" }))).toBe(false);
    expect(isDefaultCriteria(criteria({ status: "pending" }))).toBe(false);
    expect(isDefaultCriteria(criteria({ country: "UY" }))).toBe(false);
    expect(isDefaultCriteria(criteria({ sort: "name" }))).toBe(false);
    expect(isDefaultCriteria(criteria({ dir: "asc" }))).toBe(false);
  });
});
