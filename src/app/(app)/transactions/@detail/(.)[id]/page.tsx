"use client";

import { Modal } from "@/components/modal";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";
import TransactionDetailPage from "../../[id]/page";

/**
 * Intercepta `/transactions/[id]` cuando se navega DESDE `/transactions`
 * (mismo patrón que `(app)/@modal/(.)add`) — en desktop lo dibuja inline
 * en la columna de detalle de `transactions/layout.tsx`; en mobile, como
 * overlay de pantalla completa (`Modal`), porque ahí no hay una segunda
 * columna que lo contenga. Navegación directa (refresh, link externo)
 * sigue yendo al archivo canónico `[id]/page.tsx`, sin este wrapper.
 */
export default function InterceptedTransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);
  if (isSplit) return <TransactionDetailPage params={params} />;
  return (
    <Modal contained>
      <TransactionDetailPage params={params} />
    </Modal>
  );
}
