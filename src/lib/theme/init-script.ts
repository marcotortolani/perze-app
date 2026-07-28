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
