"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "./request";
import { routing } from "./routing";

type Locale = (typeof routing.locales)[number];

function isSupportedLocale(value: string): value is Locale {
  return routing.locales.includes(value as Locale);
}

/**
 * El idioma es una preferencia de cuenta persistida en cookie (ver
 * `routing.ts`), no un segmento de URL — por eso cambiarlo pasa por acá en
 * vez de una navegación. `IntlBoundary` lee la cookie de forma dinámica
 * (no cacheada, ver su comentario), así que no hace falta `updateTag`: al
 * terminar la Server Action, Next ya refresca el árbol de Server Components
 * de la ruta actual y el próximo render toma el locale nuevo.
 */
export async function setLocale(locale: string): Promise<void> {
  if (!isSupportedLocale(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    path: "/",
  });
}
