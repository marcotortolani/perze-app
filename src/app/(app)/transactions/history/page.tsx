import { redirect } from "next/navigation";

/**
 * El historial dejó de ser una pantalla propia: ahora es una vista de
 * `/transactions` gobernada por `?view=history`, el mismo mecanismo que ya
 * tiene el calendario (`?view=calendar`) desde que la lista se volvió
 * master-detail por search param. Antes, tocar "Historial" en desktop
 * reemplazaba la página entera y hacía desaparecer la lista y la segunda
 * columna — acá, en cambio, el panel de meses vive en la segunda columna
 * (o inline arriba de la lista en mobile), sin desmontar nada.
 *
 * La ruta queda como redirect de compatibilidad, no se borra: el chip la
 * abría con `push`, así que hay entradas de historial reales en cualquier
 * PWA ya instalada y un 404 ahí sería una regresión. Regla 5 de `CLAUDE.md`
 * § rutas. Mismo patrón que `transactions/calendar/page.tsx`.
 */
export default function MovementsHistoryRedirect() {
  redirect("/transactions?view=history");
}
