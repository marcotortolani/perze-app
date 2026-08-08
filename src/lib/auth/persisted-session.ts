import { parseCookieHeader, stringFromBase64URL } from "@supabase/ssr";
import { env } from "@/env";

/**
 * El `user.id` de la sesión que el navegador ya tiene guardada, leído
 * directo de la cookie de Supabase — sin red y sin pasar por `getSession()`.
 *
 * **Por qué existe.** `getSession()` no sirve para arrancar sin conexión:
 * cuando el access token venció (una hora, en la práctica: cualquier
 * arranque en frío de la PWA al día siguiente), `GoTrueClient` intenta
 * refrescarlo, el refresh falla porque no hay red, y devuelve
 * `{ session: null }` — solo preserva la sesión si `expires_at * 1000 >
 * Date.now()`. Ese `null` se propaga: `useCurrentUserId()` resuelve `null`
 * → `DbOwnerSync` deja activa la base Dexie anónima (vacía) en vez de
 * `perze-<uid>` → no hay household → `OnboardingGate` redirige a
 * `/onboarding`, que no está precacheada → el service worker cae en
 * `/offline`. Resultado: la persona no puede cargar un gasto, que es la
 * única cosa que esta app promete que siempre se puede hacer.
 *
 * **Por qué la cookie y no un espejo en localStorage.** Un
 * `perze-last-user-id` sería una segunda fuente de verdad de la identidad,
 * y se desincroniza por tres caminos reales: `signOut()` limpia stores con
 * una lista explícita y una clave nueva se olvida; el navegador borra
 * cookies pero no localStorage; otra persona toca esa clave sin saber que
 * pasó a ser load-bearing. La cookie no tiene ese problema porque **es la
 * credencial misma**: si `signOut()` corre, `auth-js` la borra en el mismo
 * paso; si se limpia el navegador, se va con todo. Identidad y credencial
 * viven o mueren juntas.
 *
 * **Esto no es una decisión de autorización y no amplía ningún acceso.**
 * RLS sigue exigiendo un `auth.uid()` real en cada fila; lo único que se
 * decide con este valor es qué base Dexie abrir y qué `created_by` local
 * escribir. Si la sesión resultó revocada, esas filas quedan en el outbox
 * y RLS las rechaza igual que hoy — nunca se inventa un uid, se reusa uno
 * que el servidor emitió.
 *
 * Ante cualquier duda devuelve `null`, que es exactamente el
 * comportamiento anterior: degrada a "no sé quién sos", nunca a una
 * identidad equivocada.
 */
export function readPersistedSessionUserId(): string | null {
  if (typeof document === "undefined") return null;

  try {
    const raw = readChunkedCookie(storageKey());
    if (!raw) return null;

    const json = raw.startsWith(BASE64_PREFIX) ? stringFromBase64URL(raw.slice(BASE64_PREFIX.length)) : raw;
    const userId: unknown = (JSON.parse(json) as { user?: { id?: unknown } } | null)?.user?.id;

    return typeof userId === "string" && userId.length > 0 ? userId : null;
  } catch {
    return null;
  }
}

/** Prefijo que `@supabase/ssr` le pone al valor cuando `cookieEncoding` es `base64url` (su default en el navegador). */
const BASE64_PREFIX = "base64-";

/**
 * Replica de `sb-${hostname.split(".")[0]}-auth-token`, que es como
 * `SupabaseClient` deriva su `storageKey` por defecto. Hay que repetirlo
 * en vez de leerlo del cliente: `SupabaseClient.storageKey` está declarado
 * `protected` y TypeScript no deja tocarlo desde afuera.
 */
function storageKey(): string {
  return `sb-${new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
}

/**
 * Misma lógica que `combineChunks()` de `@supabase/ssr`: la cookie entera
 * bajo la clave, o —si la sesión no entró en los 3180 bytes de una
 * cookie— los pedazos `<key>.0`, `<key>.1`, … concatenados **en orden
 * numérico**, cortando en el primer índice que falta.
 *
 * El orden importa y no es el de `document.cookie`: el navegador no
 * garantiza ninguno en particular, así que concatenar por orden de
 * aparición arma un JSON roto en cuanto hay más de un chunk (una sesión
 * con metadata de usuario grande los tiene). Por eso se indexa primero y
 * se recorre por número después.
 */
function readChunkedCookie(key: string): string | null {
  const byName = new Map(parseCookieHeader(document.cookie).map(({ name, value }) => [name, value]));

  const whole = byName.get(key);
  if (whole) return whole;

  const chunks: string[] = [];
  for (let i = 0; ; i++) {
    const chunk = byName.get(`${key}.${i}`);
    if (!chunk) break;
    chunks.push(chunk);
  }

  return chunks.length > 0 ? chunks.join("") : null;
}
