import { THEME_STORAGE_KEY } from "./constants";

/**
 * Script bloqueante e inline para el `<head>`/primer hijo del `<body>` de
 * `layout.tsx`. Evita el flash de tema incorrecto: el sistema es
 * dark-first (`:root` ya es oscuro — ver `docs/02-design-system.md` § 1.4),
 * así que la única clase que hace falta agregar antes del primer paint es
 * `.light`, y solo cuando corresponde.
 */
export function getThemeInitScript(): string {
  return `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var t=(s==='light'||s==='dark')?s:'system';var r=t==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;if(r==='light')document.documentElement.classList.add('light');}catch(e){}})();`;
}

/**
 * D1 — mismo patrón que `getThemeInitScript()`, aplicado a `<html lang>`.
 *
 * `<html lang>` en `layout.tsx` arranca hardcodeado (idioma fuente, ES) —
 * ese componente no puede `await getLocale()` sin volver dinámica TODA la
 * ruta (rompe el partial prerendering: `cacheComponents` está prendido y
 * casi cada pantalla de `src/app/(app)` hoy sale `◐` — prerenderizada con
 * contenido dinámico en streaming, no `ƒ` completamente dinámica). La
 * corrección vivía en un `useEffect` (`sync-html-lang.tsx`), que corre
 * DESPUÉS de la hidratación: un lector de pantalla que arranca a leer
 * apenas aparece contenido en pantalla podía alcanzar a anunciar con la
 * voz del idioma equivocado antes de que el efecto corriera.
 *
 * Este script corre síncrono, antes del primer paint (igual que el de
 * tema arriba) — la cookie de locale (`perze_locale`, ver
 * `src/i18n/request.ts`) es legible desde `document.cookie` porque no es
 * `httpOnly`. Sin cookie, cae a `navigator.language` como equivalente
 * cliente-side de la negociación por `Accept-Language` que ya hace el
 * server; sin nada de eso, al idioma fuente (`es`).
 */
export function getLangInitScript(cookieName: string, supportedLocales: readonly string[], defaultLocale: string): string {
  return `(function(){try{var m=document.cookie.match(new RegExp('(?:^|; )'+${JSON.stringify(cookieName)}+'=([^;]*)'));var supported=${JSON.stringify(supportedLocales)};var c=m?decodeURIComponent(m[1]):null;var l=supported.indexOf(c)!==-1?c:null;if(!l){var n=(navigator.language||'').slice(0,2);if(supported.indexOf(n)!==-1)l=n;}document.documentElement.lang=l||${JSON.stringify(defaultLocale)};}catch(e){}})();`;
}
