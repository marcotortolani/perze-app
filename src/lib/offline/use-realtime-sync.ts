"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { pullFromRemote } from "./pull";
import { invalidateAfterPull } from "./invalidate-after-pull";

const DEBOUNCE_MS = 300;

/**
 * F3 de AC-14 (`docs/plan-sync-incremental.md` § 6) — Realtime como atajo de
 * latencia sobre el pull de 30s de `use-sync-loop.ts`, no como reemplazo:
 * este hook nunca aplica el payload del evento directo a Dexie, solo lo usa
 * como señal de "algo cambió, andá a buscarlo" y dispara el mismo
 * `pullFromRemote` con el mismo merge por outbox. Así una reconexión, un
 * mensaje perdido, o un evento que llegó mientras la pestaña dormía nunca
 * dejan al dispositivo desincronizado — el pull de 30s los cubre igual.
 *
 * Debounce de 300ms: varios cambios seguidos (p. ej. un import) disparan un
 * solo pull, no uno por fila.
 */
export function useRealtimeSync(): void {
  const { data: household } = useCurrentHousehold();
  const householdId = household?.id ?? null;
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!householdId) return;

    const supabase = createClient();
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    function scheduleSync() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void (async () => {
          try {
            const result = await pullFromRemote(householdId!);
            if (!cancelled) invalidateAfterPull(queryClient, result);
          } catch {
            // Red de seguridad real: el próximo tick de 30s de
            // `use-sync-loop.ts` reintenta con el mismo watermark. Un
            // evento de Realtime perdido o fallido nunca es fatal.
          }
        })();
      }, DEBOUNCE_MS);
    }

    channel = supabase
      .channel(`transactions:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `household_id=eq.${householdId}` }, scheduleSync)
      .subscribe();

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [householdId, queryClient]);
}
