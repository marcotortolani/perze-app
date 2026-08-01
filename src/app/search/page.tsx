import { redirect } from "next/navigation";

/**
 * Punto de entrada viejo (B8) — reemplazado por el buscador flotante de
 * `(app)/layout.tsx`. Se mantiene como redirect en vez de borrarse porque
 * hay deep links reales apuntando acá: shortcuts de PWA, `e2e/offline-no-duplicates.spec.ts`.
 * El shell interpreta `?search=1` y abre el overlay — ver esa nota en
 * `(app)/layout.tsx`.
 */
export default function SearchRedirectPage() {
  redirect("/?search=1");
}
