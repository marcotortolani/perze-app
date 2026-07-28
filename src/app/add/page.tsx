"use client";

import { useRouter } from "next/navigation";
import { CaptureFlow } from "@/features/capture/CaptureFlow";
import { useOnboardingStore } from "@/stores/onboarding-store";

/**
 * Acceso directo por URL — shortcut de la PWA, share target. Misma
 * `CaptureFlow` que la ruta interceptada, sin el overlay de modal.
 *
 * Si viene de A11 (recién cerró el onboarding), el primer gasto real es lo
 * que dispara A7/A10 (`docs/perze-plan-redesign-first-5-blocks.md` § Fase 9):
 * en vez de ir a home, va a `/onboarding/complete` a pedir el saldo inicial
 * y ofrecer instalar la PWA.
 */
export default function AddPage() {
  const router = useRouter();
  const pendingBalanceAccountId = useOnboardingStore((s) => s.draft.pendingBalanceAccountId);
  return <CaptureFlow onClose={() => router.push(pendingBalanceAccountId ? "/onboarding/complete" : "/")} />;
}
