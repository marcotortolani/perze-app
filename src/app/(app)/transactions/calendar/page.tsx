import { redirect } from "next/navigation";

/**
 * El calendario dejó de ser una pantalla propia: ahora es una vista de
 * `/transactions` gobernada por `?view=calendar`, que es lo que el diseño
 * planteaba desde el principio (`docs/design/bloque-d-movimientos.html` lo
 * dibuja con el header de Movimientos y sin botón de volver).
 *
 * La ruta queda como redirect de compatibilidad, no se borra: el chip la abría
 * con `push`, así que hay entradas de historial reales en cualquier PWA ya
 * instalada y un 404 ahí sería una regresión. Regla 5 de `CLAUDE.md` § rutas.
 *
 * Va como server component con `redirect()` y no como el `useEffect` +
 * `router.replace` del redirect de `[id]`: acá no hay ningún param dinámico
 * que leer, así que se resuelve en el servidor, sin flash de pantalla vacía.
 */
export default function MovementsCalendarRedirect() {
  redirect("/transactions?view=calendar");
}
