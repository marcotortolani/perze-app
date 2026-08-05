/**
 * Los tres caches de navegación que declara `src/app/sw.ts`. Nombres
 * explícitos, así que Serwist los usa tal cual (`getRuntimeName` devuelve
 * el `cacheName` sin prefijo cuando viene dado).
 */
export const NAVIGATION_CACHE_NAMES = ["pages", "pages-rsc", "pages-rsc-prefetch"] as const;

/**
 * Tira las navegaciones cacheadas después de un cambio de sesión.
 *
 * Sin esto, todo lo que el usuario visitó SIN sesión quedó guardado como
 * la respuesta de `/` — el proxy redirige a `/login`, el service worker
 * sigue el redirect y guarda ese HTML/RSC bajo la clave de `/`. Al entrar,
 * el `NetworkFirst` de navegación cae al cache apenas la red tarda más de
 * 3 segundos y devuelve `/login` con una sesión perfectamente válida.
 *
 * El filtro de `sw.ts` evita que se vuelva a guardar una respuesta
 * redirigida, pero no borra lo que ya está en el dispositivo: cualquier
 * PWA instalada antes de este fix arrastra las entradas envenenadas hasta
 * que algo las pise. Esto las pisa.
 *
 * Best-effort a propósito: sin `caches` (SSR, navegador viejo, contexto no
 * seguro) no pasa nada. Nunca puede romper un login.
 */
export async function purgeNavigationCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    await Promise.all(NAVIGATION_CACHE_NAMES.map((name) => caches.delete(name)));
  } catch {
    // Un fallo de CacheStorage no puede bloquear la transición de sesión.
  }
}
