"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { outbox } from "./outbox";
import { drainOutbox } from "./sync-worker";

const POLL_INTERVAL_MS = 30_000;

/**
 * Dispara el drenaje del outbox (BASE-05): al montar, cuando vuelve la
 * conexión, y cada 30s mientras haya algo pendiente. No hace nada más que
 * eso — `drainOutbox()` ya deja cada entrada fallida en la cola con su
 * error guardado (`markFailed`), así que un fallo acá nunca tira la app ni
 * pierde una mutación.
 *
 * Sin sesión real (C7 pendiente) esto va a fallar en cada intento —
 * comportamiento esperado: toda policy de INSERT/UPDATE exige
 * `created_by = auth.uid()`. El loop sigue funcionando igual una vez que
 * haya login: no hace falta tocar nada acá.
 */
export function useSyncLoop(): void {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (supabaseRef.current === null) supabaseRef.current = createClient();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (cancelled) return;
      const online = typeof navigator === "undefined" || navigator.onLine;
      if (online) {
        const pending = await outbox.count();
        if (pending > 0) {
          await drainOutbox(supabaseRef.current!).catch(() => {
            // Un error acá (no el de una entrada puntual, que ya maneja
            // drainOutbox) sería algo más grave que el próximo tick igual reintenta.
          });
        }
      }
      if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    void tick();

    const onOnline = () => void tick();
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", onOnline);
    };
  }, []);
}
