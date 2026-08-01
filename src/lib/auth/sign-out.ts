import { createClient } from "@/lib/supabase/client";
import { getDb, switchToAnonymousDb } from "@/lib/db/client";
import { outbox } from "@/lib/offline/outbox";
import { unsubscribeFromPush } from "@/lib/push/subscribe";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { usePinStore } from "@/stores/pin-store";
import { useScopeStore } from "@/stores/scope-store";
import { useNavStore } from "@/stores/nav-store";
import { useContextualTooltipStore } from "@/stores/contextual-tooltip-store";

/**
 * B4 — no existía `signOut()` en todo el repo (`grep -rn "signOut" src/` daba
 * cero resultados): sin logout, la base Dexie y las suscripciones de push
 * sobrevivían a cualquier cambio de sesión en el mismo navegador.
 *
 * El wipe local de acá abajo asume que ya se avisó al usuario si había
 * cambios sin sincronizar — ver `countUnsyncedChanges()`, que el caller
 * (la pantalla que dispara el logout) consulta antes de confirmar.
 */
export async function signOut(): Promise<void> {
  // Best-effort: nunca bloquear el logout por un fallo de red o de push.
  await unsubscribeFromPush().catch(() => {});

  const supabase = createClient();
  await supabase.auth.signOut().catch(() => {});

  clearPersistedStores();
  await purgeCaches().catch(() => {});

  await getDb().delete();
  switchToAnonymousDb();
}

/** Cuántas mutaciones locales todavía no llegaron al servidor — para avisar antes de cerrar sesión. */
export async function countUnsyncedChanges(): Promise<number> {
  return outbox.count();
}

/**
 * Stores de Zustand persistidos en localStorage que llevan datos del
 * usuario/household actual — se limpian para que el próximo login no
 * herede PIN, borrador de onboarding, scope o tooltips ya vistos de otra
 * cuenta. `motion-store` y `privacy-store` quedan afuera a propósito: son
 * preferencias de accesibilidad del dispositivo/navegador, no de la cuenta.
 */
function clearPersistedStores(): void {
  usePinStore.persist.clearStorage();
  useOnboardingStore.persist.clearStorage();
  useScopeStore.persist.clearStorage();
  useNavStore.persist.clearStorage();
  useContextualTooltipStore.persist.clearStorage();
}

/** Vacía el CacheStorage del service worker — sin esto, respuestas cacheadas de un household ajeno (p. ej. `/api/fx`) sobreviven al logout (B5/C25). */
async function purgeCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}
