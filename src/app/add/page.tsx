"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, ZMark } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { CaptureFlow } from "@/features/capture/CaptureFlow";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useCaptureDraftStore } from "@/stores/capture-draft-store";
import { useDbOwnerStore } from "@/stores/db-owner-store";

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

  return (
    <CaptureGuard>
      <CaptureFlow onClose={() => router.push(pendingBalanceAccountId ? "/onboarding/complete" : "/")} />
    </CaptureGuard>
  );
}

/**
 * El gate propio de la captura. `OnboardingGate` exime `/add` a propósito
 * (ver el comentario de su `EXEMPT_PREFIXES`) porque acá la política de
 * rescate es distinta, y la diferencia está en una sola línea: **sin
 * conexión no se redirige**.
 *
 * El motivo es que `/onboarding` no está precacheada — no puede estarlo,
 * es una pantalla que sin servidor no hace nada. Redirigir ahí sin red
 * termina en el fallback `/offline` del service worker, o sea: la persona
 * abrió la app para cargar un gasto y la app la mandó a una pantalla de
 * error. Con el arreglo de identidad de `useCurrentUserId()` este camino
 * casi no se ejecuta (offline + sesión guardada ⇒ hay `userId` ⇒ hay
 * household), pero tiene que existir igual, porque es lo que impide el
 * loop `/offline` → "Cargar un movimiento" → `/add` → `/onboarding` →
 * `/offline`.
 *
 * Sin household local no hay nada honesto que hacer: un movimiento
 * necesita un `household_id` y no se inventa una identidad previa a la
 * cuenta (`CLAUDE.md` § "Arranque sin conexión: se descarta"). Se explica
 * y se ofrece reintentar.
 *
 * Esta duplicación de la tríada de `OnboardingGate` es deliberada: no la
 * unifiques metiendo `navigator.onLine` adentro del gate, porque eso
 * aplicaría a las 40 pantallas de la app y en todas las demás redirigir es
 * lo correcto.
 */
function CaptureGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const online = useOnlineStatus();
  const { data: household, isLoading } = useCurrentHousehold();
  const userId = useEffectiveUserId();
  const dbSettled = useDbOwnerStore((s) => s.settled);

  const ready = dbSettled && !isLoading && userId !== undefined;
  const blocked = ready && (household === null || userId === null);

  useEffect(() => {
    if (!blocked || !online) return;
    router.replace("/onboarding");
  }, [blocked, online, router]);

  if (blocked && !online) {
    return (
      <ScreenShell style={{ alignItems: "center", justifyContent: "center" }}>
        <EmptyState message={t("capture.noLocalDataOffline")} actionLabel={t("common.retry")} onAction={() => window.location.reload()} />
      </ScreenShell>
    );
  }

  if (!ready || blocked) {
    return (
      <ScreenShell style={{ alignItems: "center", justifyContent: "center" }}>
        <ZMark size={16} gap={5} animated variant="sweep" aria-label={t("app.name")} />
      </ScreenShell>
    );
  }

  return <>{children}</>;
}
