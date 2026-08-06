import { redirect } from "next/navigation";

/**
 * Stub de redirect de compatibilidad — "Estado de los precios" pasó a ser
 * "Instrumentos" (`/investments/instruments`, I4/I12). `CLAUDE.md` §
 * convención de rutas, punto 5: hay una PWA instalada con historial largo,
 * un 404 acá sería una regresión real.
 */
export default function LegacyPricesStatusPage() {
  redirect("/investments/instruments");
}
