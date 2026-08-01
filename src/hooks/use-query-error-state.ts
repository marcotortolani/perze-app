"use client";

import { useTranslations } from "next-intl";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ErrorStateProps } from "@/design-system/feedback/ErrorState";

export interface QueryErrorStateOptions {
  /** Qué pasó, en las palabras del usuario — nunca el mensaje técnico de `error`. */
  what: string;
  next?: string | undefined;
  /** CON-16: camino alternativo antes de "reintentar" (ej. "ver offline"). */
  alternativeLabel?: string | undefined;
  onAlternative?: (() => void) | undefined;
}

/**
 * CON-20: el patrón de estado de error que no existía en ningún hook
 * (`isError` no se usaba en `src/` antes de esto). Envuelve el resultado de
 * un `useQuery` y devuelve props listas para `<ErrorState {...errorState} />`,
 * o `null` mientras no hay error — así cada pantalla solo agrega:
 *
 *   const errorState = useQueryErrorState(accountsQuery, { what: t(...) });
 *   if (errorState) return <ErrorState {...errorState} />;
 */
export function useQueryErrorState(
  query: Pick<UseQueryResult<unknown, unknown>, "isError" | "refetch">,
  options: QueryErrorStateOptions
): ErrorStateProps | null {
  const t = useTranslations();
  if (!query.isError) return null;
  return {
    what: options.what,
    next: options.next,
    onRetry: () => void query.refetch(),
    retryLabel: t("common.retry"),
    onAlternative: options.onAlternative,
    alternativeLabel: options.alternativeLabel,
  };
}
