"use client";

import { getDb, switchToAnonymousDb } from "@/lib/db/client";
import { DEMO_COOKIE_NAME } from "./demo-cookie";

/**
 * Modo demo — §0 del plan de acceso controlado. El household sembrado por
 * `seedDemoHousehold()` vive solo en Dexie y nunca en Supabase (nada de
 * `signInAnonymously()`: eso crearía una fila real en `auth.users`, y con
 * el gate de aprobación del operador el usuario demo nacería `pending` y
 * quedaría bloqueado). La cookie es la única señal que cruza al servidor,
 * para que `proxy.ts` deje pasar `/` sin sesión real.
 *
 * `max-age` de 30 días: alcanza para explorar la app sin sesión sin dejar
 * la cookie viva indefinidamente si alguien no la cierra explícitamente.
 */
export function enterDemoMode(): void {
  document.cookie = `${DEMO_COOKIE_NAME}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function isDemoModeActive(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c === `${DEMO_COOKIE_NAME}=1`);
}

/**
 * Borra SOLO la cookie, sin tocar Dexie — para el momento en que aparece
 * una sesión real con la cookie de demo todavía viva (el usuario fue del
 * demo directo a registrarse): la señal de demo tiene que morir ya, pero
 * el wipe de la base anónima lo decide `DbOwnerSync`, que es quien sabe
 * qué base está activa y evita borrar la base namespaced del usuario.
 */
export function clearDemoCookie(): void {
  document.cookie = `${DEMO_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}

/**
 * Sale del demo: borra la cookie y la base Dexie anónima entera (mismo
 * wipe que `signOut()` hace para una sesión real) para que un login
 * posterior no encuentre el household de demo y `DbOwnerSync` namespaced
 * la base sin la salvaguarda de "legacy ya tiene household" de por medio.
 */
export async function exitDemoMode(): Promise<void> {
  clearDemoCookie();
  await getDb().delete();
  switchToAnonymousDb();
}
