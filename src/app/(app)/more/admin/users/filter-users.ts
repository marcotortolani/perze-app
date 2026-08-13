import type { AccessRequest } from "@/lib/repos/admin-repo";
import type { AccessStatus } from "@/lib/repos/profiles-repo";
import { normalize, scoreMatch } from "@/lib/search/rank";

/**
 * Lógica pura de filtrado/búsqueda/orden de `/more/admin/users` — sin
 * React, sin i18n, sin `Date` implícito (todo `now`/comparación se recibe
 * o se deriva de campos ya guardados). Filtra 100% en cliente sobre el
 * array completo que devuelve `admin_list_access_requests()`: no hay
 * migración de SQL detrás de esto, ver el plan de rediseño de la pantalla.
 */

export type StatusFilter = AccessStatus | "all";
export type SortField = "name" | "requestedAt" | "lastSeenAt";
export type SortDir = "asc" | "desc";

export interface UsersCriteria {
  query: string;
  status: StatusFilter;
  country: string | null;
  sort: SortField;
  dir: SortDir;
}

export const DEFAULT_CRITERIA: UsersCriteria = {
  query: "",
  status: "all",
  country: null,
  sort: "requestedAt",
  dir: "desc",
};

export function isDefaultCriteria(c: UsersCriteria): boolean {
  return c.query === DEFAULT_CRITERIA.query && c.status === DEFAULT_CRITERIA.status && c.country === DEFAULT_CRITERIA.country && c.sort === DEFAULT_CRITERIA.sort && c.dir === DEFAULT_CRITERIA.dir;
}

function displayLabel(u: AccessRequest): string {
  return u.email ?? u.displayName ?? "";
}

/** Score de búsqueda de un usuario contra una necesidad ya normalizada — email y nombre, el mayor de los dos. 0 = sin match. */
function searchScore(u: AccessRequest, needle: string): number {
  const emailScore = u.email ? (scoreMatch(normalize(u.email), needle) ?? 0) : 0;
  const nameScore = u.displayName ? (scoreMatch(normalize(u.displayName), needle) ?? 0) : 0;
  return Math.max(emailScore, nameScore);
}

/**
 * Compara dos filas por un campo, YA con la dirección aplicada. `dirSign`
 * solo invierte la comparación de valores reales — el orden de los `null`
 * de `lastSeenAt` ("nunca se conectó" siempre al final) es una regla fija
 * que no depende de la dirección, y por eso se resuelve ANTES de aplicar
 * el signo, no multiplicando el resultado entero por él (ese fue el bug:
 * multiplicar por `dirSign = -1` en `desc` mandaba los `null` al frente).
 */
function compareByField(a: AccessRequest, b: AccessRequest, field: SortField, dirSign: 1 | -1): number {
  switch (field) {
    case "name":
      return displayLabel(a).localeCompare(displayLabel(b)) * dirSign;
    case "requestedAt":
      return (a.accessRequestedAt < b.accessRequestedAt ? -1 : a.accessRequestedAt > b.accessRequestedAt ? 1 : 0) * dirSign;
    case "lastSeenAt": {
      if (a.lastSeenAt === null && b.lastSeenAt === null) return 0;
      if (a.lastSeenAt === null) return 1;
      if (b.lastSeenAt === null) return -1;
      return (a.lastSeenAt < b.lastSeenAt ? -1 : a.lastSeenAt > b.lastSeenAt ? 1 : 0) * dirSign;
    }
  }
}

/** Desempate final, siempre por `profileId` — sin esto, dos fechas
 * idénticas pueden reordenarse entre renders y el virtualizador ve saltar
 * filas visibles. */
function compareStable(a: AccessRequest, b: AccessRequest): number {
  return a.profileId < b.profileId ? -1 : a.profileId > b.profileId ? 1 : 0;
}

export function filterAndSortUsers(users: AccessRequest[], criteria: UsersCriteria): AccessRequest[] {
  const needle = normalize(criteria.query);

  let rows = users;
  if (criteria.status !== "all") rows = rows.filter((u) => u.accessStatus === criteria.status);
  if (criteria.country) rows = rows.filter((u) => u.country === criteria.country);

  const dirSign: 1 | -1 = criteria.dir === "asc" ? 1 : -1;

  if (needle) {
    const scored = rows.map((u) => ({ u, score: searchScore(u, needle) })).filter((r) => r.score > 0);
    // Con búsqueda activa, el score manda; el criterio de orden elegido
    // desempata entre resultados con el mismo score.
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return compareByField(a.u, b.u, criteria.sort, dirSign) || compareStable(a.u, b.u);
    });
    return scored.map((r) => r.u);
  }

  return [...rows].sort((a, b) => compareByField(a, b, criteria.sort, dirSign) || compareStable(a, b));
}

/** Siempre sobre el array COMPLETO — el banner cuenta pendientes reales, no lo que sobrevive a otros filtros. */
export function countPending(users: AccessRequest[]): number {
  return users.filter((u) => u.accessStatus === "pending").length;
}

/** Países únicos presentes en la lista, sin `null`, ordenados alfabéticamente por código. */
export function countriesOf(users: AccessRequest[]): string[] {
  const set = new Set<string>();
  for (const u of users) if (u.country) set.add(u.country);
  return [...set].sort((a, b) => a.localeCompare(b));
}
