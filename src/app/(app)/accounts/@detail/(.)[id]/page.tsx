"use client";

import { Modal } from "@/components/modal";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";
import AccountDetailPage from "../../[id]/page";

/** Intercepta `/accounts/[id]` — ver la nota en `transactions/@detail/(.)[id]/page.tsx`, mismo patrón. */
export default function InterceptedAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);
  if (isSplit) return <AccountDetailPage params={params} />;
  return (
    <Modal contained>
      <AccountDetailPage params={params} />
    </Modal>
  );
}
