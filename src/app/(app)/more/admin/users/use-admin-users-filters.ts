"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_CRITERIA, type SortDir, type SortField, type StatusFilter, type UsersCriteria } from "./filter-users";

const STATUS_VALUES: StatusFilter[] = ["all", "pending", "approved", "rejected", "disabled"];
const SORT_FIELDS: SortField[] = ["name", "requestedAt", "lastSeenAt"];

function parseSort(raw: string | null): { sort: SortField; dir: SortDir } {
  if (!raw) return { sort: DEFAULT_CRITERIA.sort, dir: DEFAULT_CRITERIA.dir };
  const [field, dir] = raw.split(":");
  const sort = SORT_FIELDS.includes(field as SortField) ? (field as SortField) : DEFAULT_CRITERIA.sort;
  const parsedDir: SortDir = dir === "asc" ? "asc" : dir === "desc" ? "desc" : DEFAULT_CRITERIA.dir;
  return { sort, dir: parsedDir };
}

/**
 * Criterios de `/more/admin/users` ↔ search params (`q`, `status`, `country`,
 * `sort`). En URL, no en `useState` local: el flujo real del operador es
 * filtrar → abrir un usuario (`?user=`) → decidir → `router.back()` → seguir,
 * y con la URL el back devuelve exactamente a la lista filtrada. Además
 * `?status=pending` es un link que se manda por chat.
 *
 * `q` es la excepción: el input NO se controla desde `searchParams` (eso
 * metería un round-trip del router por tecla y haría saltar el cursor). Se
 * hidrata una sola vez como estado inicial perezoso y escribe la URL con
 * debounce — lo que de verdad filtra es el valor local con `useDeferredValue`
 * en el componente que lo consume, no la URL.
 *
 * Los filtros siempre navegan con `replace` (nunca `push`): si un cambio de
 * filtro empujara historial, el back desde el detalle recorrería cada tecla
 * tipeada antes de cerrar el panel. Solo `?user=` usa `push` (en `page.tsx`).
 */
export function useAdminUsersFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rawQuery, setRawQuery] = useState(() => searchParams.get("q") ?? "");

  const status: StatusFilter = STATUS_VALUES.includes(searchParams.get("status") as StatusFilter) ? (searchParams.get("status") as StatusFilter) : DEFAULT_CRITERIA.status;
  const country = searchParams.get("country");
  const { sort, dir } = parseSort(searchParams.get("sort"));

  const criteria: UsersCriteria = { query: rawQuery, status, country, sort, dir };

  const replaceParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  // Debounce de 300ms para escribir `q` en la URL — el filtrado real usa
  // `rawQuery` (vía `useDeferredValue` en el consumidor), esto es solo para
  // que la URL sea compartible sin generar una entrada de historial por tecla.
  useEffect(() => {
    const id = setTimeout(() => replaceParams({ q: rawQuery || null }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reaccionar a rawQuery, no a replaceParams (cambia con cada searchParams)
  }, [rawQuery]);

  const setStatus = useCallback((next: StatusFilter) => replaceParams({ status: next === DEFAULT_CRITERIA.status ? null : next }), [replaceParams]);
  const setCountry = useCallback((next: string | null) => replaceParams({ country: next }), [replaceParams]);
  const setSort = useCallback(
    (nextSort: SortField, nextDir: SortDir) => replaceParams({ sort: nextSort === DEFAULT_CRITERIA.sort && nextDir === DEFAULT_CRITERIA.dir ? null : `${nextSort}:${nextDir}` }),
    [replaceParams],
  );
  const clear = useCallback(() => {
    setRawQuery("");
    replaceParams({ q: null, status: null, country: null, sort: null });
  }, [replaceParams]);

  return { criteria, setQuery: setRawQuery, setStatus, setCountry, setSort, clear };
}
