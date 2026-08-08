import { createClient } from "@/lib/supabase/client";
import { getDb, switchToAnonymousDb } from "@/lib/db/client";
import { outbox } from "@/lib/offline/outbox";
import { unsubscribeFromPush } from "@/lib/push/subscribe";
import { clearPendingInviteCode } from "@/lib/onboarding/pending-invite";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { usePinStore } from "@/stores/pin-store";
import { useScopeStore } from "@/stores/scope-store";
import { useNavStore } from "@/stores/nav-store";
import { useContextualTooltipStore } from "@/stores/contextual-tooltip-store";
import { useInstrumentPricesStore } from "@/stores/instrument-prices-store";

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
 * herede PIN, borrador de onboarding, scope, tooltips ya vistos o precios
 * de instrumentos de otra cuenta. También se limpia el código de
 * invitación pendiente (`perze:pendingInvite`), que es de otra persona.
 *
 * Quedan afuera a propósito, porque son preferencias del dispositivo/
 * navegador y no de la cuenta: `motion-store`, `privacy-store`,
 * `format-preferences-store`, tema (`perze-theme`), fondo de puntos
 * (`perze-backdrop`), cuarto tab elegido (`perze-fourth-tab` — nav-store
 * SÍ se limpia, ver abajo) y la moneda de visualización del patrimonio
 * neto (`net-worth-currency-store`).
 *
 * Nota: `nav-store` (cuarto tab) SÍ se limpia — a diferencia de las
 * anteriores, cuáles módulos están disponibles ahí depende de
 * `enabled_modules` del household, así que es estado de cuenta, no de
 * dispositivo.
 */
function clearPersistedStores(): void {
  usePinStore.persist.clearStorage();
  useOnboardingStore.persist.clearStorage();
  useScopeStore.persist.clearStorage();
  useNavStore.persist.clearStorage();
  useContextualTooltipStore.persist.clearStorage();
  useInstrumentPricesStore.persist.clearStorage();
  clearPendingInviteCode();
}

/** Vacía el CacheStorage del service worker — sin esto, respuestas cacheadas de un household ajeno (p. ej. `/api/fx`) sobreviven al logout (B5/C25). */
async function purgeCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}
