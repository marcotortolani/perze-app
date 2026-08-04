import { BACKDROP_DENSITIES, BACKDROP_DENSITY_DEFAULT, BACKDROP_INTENSITIES, BACKDROP_INTENSITY_DEFAULT, BACKDROP_STORAGE_KEY } from "./constants";

/**
 * Script bloqueante e inline para el primer hijo del `<body>` de
 * `layout.tsx` — mismo patrón que `getThemeInitScript()`
 * (`src/lib/theme/init-script.ts`). Sin esto, encender el fondo de puntos
 * en Ajustes recién se vería en la carga siguiente: cada navegación dura
 * hidrata `<html>` desde cero, y leer `localStorage` en un `useEffect`
 * corre después del primer paint — un flash de "aparece de golpe" en vez
 * de estar ya ahí. El default es apagado (`docs/02-design-system.md` § 1.8),
 * así que sin preferencia guardada este script no toca el DOM.
 *
 * Valida contra las listas de valores elegibles antes de escribir los
 * `data-attribute` — un valor corrupto o fuera de rango en `localStorage`
 * cae al default en vez de propagarse.
 */
export function getBackdropInitScript(): string {
  return `(function(){try{var k=${JSON.stringify(BACKDROP_STORAGE_KEY)};var raw=localStorage.getItem(k);if(!raw)return;var p=JSON.parse(raw);var densities=${JSON.stringify(BACKDROP_DENSITIES)};var intensities=${JSON.stringify(BACKDROP_INTENSITIES)};var d=densities.indexOf(p.density)!==-1?p.density:${JSON.stringify(BACKDROP_DENSITY_DEFAULT)};var i=intensities.indexOf(p.intensity)!==-1?p.intensity:${JSON.stringify(BACKDROP_INTENSITY_DEFAULT)};var el=document.documentElement;el.setAttribute('data-backdrop',p.enabled===true?'on':'off');el.setAttribute('data-backdrop-density',d);el.setAttribute('data-backdrop-intensity',i);}catch(e){}})();`;
}
