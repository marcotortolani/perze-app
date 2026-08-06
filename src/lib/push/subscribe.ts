import { pushSubscriptionsRepo } from "../repos/push-subscriptions-repo";

function base64UrlToUint8Array(base64Url: string): BufferSource {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new ArrayBuffer(raw.length);
  const view = new Uint8Array(bytes);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return bytes;
}

export class PushUnsupportedError extends Error {}

/** K12 — pide permiso y suscribe este navegador a push. Falla explícito si el navegador no soporta Push API (Safari viejo, PWA no instalada en iOS) en vez de fallar en silencio. */
export async function subscribeToPush(profileId: string): Promise<PushSubscription> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new PushUnsupportedError();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permiso de notificaciones denegado");

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(publicKey) }));
  await pushSubscriptionsRepo.save(profileId, subscription);
  return subscription;
}

/**
 * `navigator.serviceWorker.ready` no es "¿hay un SW registrado?" — es
 * "esperá a que termine de activarse el que se está registrando ahora".
 * Sin ningún SW controlando la página (el caso normal en `pnpm dev`: no se
 * registra salvo `NEXT_PUBLIC_ENABLE_SW_IN_DEV=1`, `CLAUDE.md` § gotchas)
 * esa promesa **no rechaza, se queda pendiente para siempre**. Antes estas
 * dos funciones asumían que "serviceWorker" en `navigator` alcanzaba para
 * esperar `.ready` con seguridad, y eso colgaba en dev cualquier caller —
 * `unsubscribeFromPush()` es el primer `await` de `signOut()`
 * (`lib/auth/sign-out.ts`), así que colgaba el cierre de sesión entero sin
 * ningún error visible. `controller` es la señal correcta de "hay un SW
 * activo ahora mismo, andá a buscar su suscripción" — sin él no hay nada
 * que desuscribir.
 */
function hasActiveServiceWorker(): boolean {
  return "serviceWorker" in navigator && navigator.serviceWorker.controller !== null;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!hasActiveServiceWorker()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await pushSubscriptionsRepo.remove(endpoint);
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!hasActiveServiceWorker()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}
