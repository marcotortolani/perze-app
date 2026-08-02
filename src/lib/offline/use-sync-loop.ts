"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getDb } from "@/lib/db/client";
import { outbox } from "./outbox";
import { drainOutbox } from "./sync-worker";
import { pullFromRemote } from "./pull";

const POLL_INTERVAL_MS = 30_000;
const CURRENT_HOUSEHOLD_META_KEY = "currentHouseholdId";

/**
 * Dispara el ciclo de sync (BASE-05 + AC-14, `docs/plan-sync-incremental.md`):
 * al montar, cuando vuelve la conexión, y cada 30s. Push primero, pull
 * después, siempre en ese orden — lo local pendiente sube antes de que
 * el pull traiga la foto del servidor, así el merge del pull ve el outbox
 * más al día.
 *
 * El pull corre SIEMPRE que hay household activo, sin importar si el
 * outbox tiene algo pendiente — a diferencia del push. Un dispositivo que
 * solo lee (nunca escribió nada) tiene el outbox vacío por definición: si
 * el pull quedara adentro del `if (pending > 0)` del push, nunca vería lo
 * que otro dispositivo cargó. Es exactamente el caso de uso que este ciclo
 * existe para cubrir.
 *
 * Un fallo en cualquiera de los dos pasos nunca tira la app ni pierde una
 * mutación: `drainOutbox()` deja cada entrada fallida en la cola con su
 * error (`markFailed`), y un pull fallido simplemente reintenta en el
 * próximo tick con el mismo watermark.
 */
export function useSyncLoop(): void {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (supabaseRef.current === null) supabaseRef.current = createClient();
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (cancelled) return;
      try {
        const online = typeof navigator === "undefined" || navigator.onLine;
        if (online) {
          const pending = await outbox.count();
          if (pending > 0) {
            await drainOutbox(supabaseRef.current!);
          }

          const householdId = (await getDb().meta.get(CURRENT_HOUSEHOLD_META_KEY))?.value as string | undefined;
          if (householdId) {
            await pullFromRemote(householdId);
            if (!cancelled) await queryClient.invalidateQueries();
          }
        }
      } catch {
        // AC-17b (`docs/auditoria-acceso.md`) — antes `outbox.count()`
        // corría FUERA de todo catch: un rechazo suyo (típico:
        // DatabaseClosedError, porque `DbOwnerSync` cierra/borra la base
        // Dexie justo en el login) mataba la promesa de tick ANTES de
        // re-armar el timer, y el loop de sync quedaba muerto en silencio
        // para toda la sesión — nada volvía a drenar hasta recargar la
        // página. Mismo tratamiento para el pull: el próximo tick
        // reintenta lo que sea que haya fallado, con el watermark que
        // haya quedado guardado.
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    }

    void tick();

    const onOnline = () => void tick();
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [queryClient]);
}
