"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { CaptureFlow } from "@/features/capture/CaptureFlow";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { advanceFirstTx } from "@/lib/onboarding/first-tx-machine";

/**
 * Si viene de A11 (recién cerró el onboarding), `firstTxStep` guía el
 * primer ingreso y el primer gasto reales — mismo mecanismo que en `/add`
 * (la variante sin interceptar). Cuando la máquina no da una ruta nueva
 * (fuera del flujo, o cancelado), cae a `router.back()`: simétrico al
 * `push` con el que se abrió esta navegación blanda.
 */
export default function InterceptedAddPage() {
  const router = useRouter();
  const firstTxStep = useOnboardingStore((s) => s.draft.firstTxStep);
  const setOnboardingField = useOnboardingStore((s) => s.setField);
  return (
    <Modal>
      <CaptureFlow
        onClose={(result) => {
          const { next, route } = advanceFirstTx(firstTxStep, result.saved ? { type: "saved", kind: result.kind } : { type: "cancelled" });
          if (next !== firstTxStep) setOnboardingField("firstTxStep", next);
          if (route) router.push(route);
          else router.back();
        }}
      />
    </Modal>
  );
}
