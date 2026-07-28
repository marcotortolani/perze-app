import type { QueryClient, QueryKey, UseMutationOptions } from "@tanstack/react-query";
import { outbox } from "./outbox";

export interface OptimisticMutationConfig<TInput, TData, TQueryData> {
  queryClient: QueryClient;
  /** La query (o queries) que esta mutación afecta — se invalida al terminar. */
  queryKey: QueryKey;
  /** Escritura real: local (Dexie, vía un repo) hoy; local + red cuando haya backend. */
  mutationFn: (input: TInput) => Promise<TData>;
  /** Cómo se ve el cache de la query mientras la mutación está en vuelo. */
  optimisticUpdate: (previous: TQueryData | undefined, input: TInput) => TQueryData;
  /** Para encolar en el outbox — `null` si esta mutación no necesita sync futuro. */
  outboxEntry?: (input: TInput, data: TData) => {
    table: string;
    op: "insert" | "update" | "delete";
    entityId: string;
    payload: unknown;
    clientRev: number;
  } | null;
}

/**
 * El patrón completo de `docs/05-prompts-desarrollo.md` § C5: la UI se
 * actualiza optimista, el outbox queda registrado, y si algo no
 * recuperable falla se revierte al snapshot previo. Pensado para pasarse
 * directo a `useMutation()` de TanStack Query.
 */
export function createOptimisticMutation<TInput, TData, TQueryData = TData>(
  config: OptimisticMutationConfig<TInput, TData, TQueryData>
): UseMutationOptions<TData, Error, TInput, { previous: TQueryData | undefined }> {
  const { queryClient, queryKey, mutationFn, optimisticUpdate, outboxEntry } = config;

  return {
    mutationFn,

    async onMutate(input) {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TQueryData>(queryKey);
      queryClient.setQueryData<TQueryData>(queryKey, (old) => optimisticUpdate(old, input));
      return { previous };
    },

    onError(_error, _input, context) {
      // Rollback: la transacción nunca "no se guardó" localmente (eso ya
      // pasó en `mutationFn`); esto es solo la UI optimista volviendo a su
      // estado si el paso posterior (p. ej. encolar) fallara.
      if (context) queryClient.setQueryData(queryKey, context.previous);
    },

    async onSuccess(data, input) {
      if (!outboxEntry) return;
      const entry = outboxEntry(input, data);
      if (entry) await outbox.enqueue(entry);
    },

    async onSettled() {
      await queryClient.invalidateQueries({ queryKey });
    },
  };
}
