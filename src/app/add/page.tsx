"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CaptureFlow } from "@/features/capture/CaptureFlow";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useCaptureDraftStore } from "@/stores/capture-draft-store";

/**
 * Acceso directo por URL — shortcut de la PWA, share target. Misma
 * `CaptureFlow` que la ruta interceptada, sin el overlay de modal.
 *
 * Si viene de A11 (recién cerró el onboarding), el primer gasto real es lo
 * que dispara A7/A10 (`docs/perze-plan-redesign-first-5-blocks.md` § Fase 9):
 * en vez de ir a home, va a `/onboarding/complete` a pedir el saldo inicial
 * y ofrecer instalar la PWA.
 *
 * `?title=&note=&url=` llegan del `share_target` del manifest (compartir
 * desde otra app) — se vuelcan una sola vez a la nota del borrador, nunca
 * se sobreescribe lo que el usuario ya haya tipeado.
 */
export default function AddPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingBalanceAccountId = useOnboardingStore((s) => s.draft.pendingBalanceAccountId);
  const setField = useCaptureDraftStore((s) => s.setField);
  const appliedShareTarget = useRef(false);

  useEffect(() => {
    if (appliedShareTarget.current) return;
    appliedShareTarget.current = true;
    const shared = [searchParams.get("title"), searchParams.get("note"), searchParams.get("url")].filter(Boolean).join(" — ");
    if (shared) setField("note", shared);
  }, [searchParams, setField]);

  return <CaptureFlow onClose={() => router.push(pendingBalanceAccountId ? "/onboarding/complete" : "/")} />;
}
