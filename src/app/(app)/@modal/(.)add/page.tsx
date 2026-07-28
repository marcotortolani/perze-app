"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { CaptureFlow } from "@/features/capture/CaptureFlow";
import { useOnboardingStore } from "@/stores/onboarding-store";

/**
 * Si viene de A11 (recién cerró el onboarding), el primer gasto real
 * dispara A7/A10 — `router.back()` volvería a la pantalla de éxito en vez
 * de seguir para adelante, así que ese caso se resuelve igual que en
 * `/add` (la variante sin interceptar): push explícito, no back.
 */
export default function InterceptedAddPage() {
  const router = useRouter();
  const pendingBalanceAccountId = useOnboardingStore((s) => s.draft.pendingBalanceAccountId);
  return (
    <Modal>
      <CaptureFlow onClose={() => (pendingBalanceAccountId ? router.push("/onboarding/complete") : router.back())} />
    </Modal>
  );
}
