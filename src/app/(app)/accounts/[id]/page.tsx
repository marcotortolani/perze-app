"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Compatibilidad: `/accounts/<id>` dejó de ser el detalle de la cuenta — ahora
 * el detalle es una selección dentro de `/accounts?account=<id>` (ver la nota
 * larga en `../page.tsx`). Esta ruta queda viva solo para redirigir lo que
 * todavía apunte a la URL vieja: favoritos, entradas de historial de la PWA
 * instalada, un link externo.
 *
 * El directorio `[id]/` tiene que existir igual para los sub-flujos que SÍ
 * siguen siendo rutas propias (`card`, `installments`, `reconcile`), así que
 * mantener este archivo no cuesta nada y evita un 404 real.
 *
 * `replace` y no `push`: la URL vieja no tiene por qué quedar en el historial.
 */
export default function AccountDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/accounts?account=${id}`);
  }, [id, router]);

  return null;
}
