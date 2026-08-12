"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { categoriesRepo } from "@/lib/repos/categories-repo";
import { useCategoryLabel } from "./use-category-label";

export function categoryDirectoryKey(householdId: string) {
  return ["categories", householdId, "labels"] as const;
}

/**
 * Resuelve el nombre de una categoría a partir de su id, sin importar si
 * sigue activa, está archivada o fue borrada — a diferencia de `useCategories`
 * (que solo trae lo elegible HOY, `categories-repo.ts` § `list`), un
 * movimiento conserva su `categoryId` para siempre.
 *
 * Nace del mismo bug repetido en seis pantallas: cuando la categoría de un
 * gasto ya no estaba en `useCategories()`, cada una caía a su manera al
 * UUID crudo (`TransactionsDetailEmpty.tsx`, `analytics/categories`,
 * `analytics/flow`) o armaba un `CategoryRow` sintético con el id metido en
 * `name` (`analytics/insights`, `analytics/export`, `analytics/weekly`) —
 * las dos formas terminan mostrando el id igual. Este hook es el único
 * punto que debería resolver esa etiqueta de acá en más.
 *
 * Si la fila no existe en absoluto (id huérfano, o `categoryId` nulo),
 * devuelve la traducción de "Sin categoría" — nunca el id.
 */
export function useCategoryDirectory(householdId: string | undefined): (categoryId: string | null | undefined) => string {
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();
  const { data: rows } = useQuery({
    queryKey: categoryDirectoryKey(householdId ?? ""),
    queryFn: () => categoriesRepo.listForLabels(householdId!),
    enabled: !!householdId,
  });

  const byId = useMemo(() => new Map((rows ?? []).map((c) => [c.id, c])), [rows]);

  return (categoryId) => {
    const category = categoryId ? byId.get(categoryId) : undefined;
    return category ? categoryLabel(category) : t("transactions.detail.noCategory");
  };
}
