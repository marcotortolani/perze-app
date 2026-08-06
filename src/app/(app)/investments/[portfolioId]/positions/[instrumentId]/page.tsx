"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Compatibilidad: `/investments/<portfolioId>/positions/<instrumentId>`
 * dejó de ser el detalle de la posición — ahora es una selección dentro de
 * `/investments/<portfolioId>?position=<instrumentId>` (migración master-detail, ver la nota
 * larga en `../../page.tsx`). Esta ruta queda viva solo para redirigir lo
 * que todavía apunte a la URL vieja (favoritos, historial de la PWA
 * instalada, un link externo).
 *
 * `replace`, no `push`: la URL vieja no tiene por qué quedar en el historial.
 */
export default function InstrumentDetailRedirect({ params }: { params: Promise<{ portfolioId: string; instrumentId: string }> }) {
  const { portfolioId, instrumentId } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/investments/${portfolioId}?position=${instrumentId}`);
  }, [portfolioId, instrumentId, router]);

  return null;
}
