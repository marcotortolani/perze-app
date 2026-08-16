"use client";

import { useRouter } from "next/navigation";
import { Modal, useModalClose } from "@/components/modal";
import { CaptureFlow } from "@/features/capture/CaptureFlow";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { advanceFirstTx, type FirstTxStep } from "@/lib/onboarding/first-tx-machine";

/**
 * Si viene de A11 (recién cerró el onboarding), `firstTxStep` guía el
 * primer ingreso y el primer gasto reales — mismo mecanismo que en `/add`
 * (la variante sin interceptar). Cuando la máquina no da una ruta nueva
 * (fuera del flujo, o cancelado), cae al cierre animado: simétrico a la
 * entrada con la que se abrió esta navegación blanda.
 */
export default function InterceptedAddPage() {
  const router = useRouter();
  const firstTxStep = useOnboardingStore((s) => s.draft.firstTxStep);
  const setOnboardingField = useOnboardingStore((s) => s.setField);
  return (
    <Modal>
      <InterceptedAddInner router={router} firstTxStep={firstTxStep} setOnboardingField={setOnboardingField} />
    </Modal>
  );
}

/**
 * Separado de `InterceptedAddPage`: `useModalClose()` lee el `close`
 * animado de `Modal` por contexto, y ese contexto solo existe DEBAJO de
 * `<Modal>` en el árbol — llamarlo en el componente que renderiza `<Modal>`
 * (un nivel más arriba) devolvería siempre el fallback sin animar.
 */
function InterceptedAddInner({
  router,
  firstTxStep,
  setOnboardingField,
}: {
  router: ReturnType<typeof useRouter>;
  firstTxStep: FirstTxStep | null;
  setOnboardingField: (key: "firstTxStep", value: FirstTxStep | null) => void;
}) {
  const closeModal = useModalClose();
  return (
    <CaptureFlow
      onClose={(result) => {
        const { next, route } = advanceFirstTx(firstTxStep, result.saved ? { type: "saved", kind: result.kind } : { type: "cancelled" });
        if (next !== firstTxStep) setOnboardingField("firstTxStep", next);
        if (route) router.push(route);
        else closeModal();
      }}
    />
  );
}
