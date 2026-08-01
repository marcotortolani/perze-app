/**
 * Ancho de contenido por ruta. La mayoría de las pantallas son una sola
 * columna de lectura (`narrow`, `--content-max-width`, 560px); las rutas
 * con layout de lista + detalle (`/transactions`, `/accounts`) necesitan
 * mucho más aire para que la columna de lista no quede aplastada contra el
 * panel de detalle de 420px — `wide`, `--content-max-width-wide`, 1200px.
 * Función pura (no un ternario inline en `layout.tsx`) porque esta lista va
 * a crecer — `/analytics` es la próxima candidata — y es la única pieza de
 * este ajuste testeable sin navegador.
 */
export type ContentWidth = "narrow" | "wide";

const WIDE_ROUTES = ["/transactions", "/accounts"];

export function contentWidthFor(pathname: string): ContentWidth {
  return WIDE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)) ? "wide" : "narrow";
}
