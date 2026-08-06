"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LockScreen } from "@/design-system/systems";
import { usePinStore } from "@/stores/pin-store";
import { useCaptureRecencyStore } from "@/stores/capture-recency-store";
import { verifyBiometric } from "@/lib/security/webauthn";

const UNLOCKED_SESSION_KEY = "perze:pinUnlocked";

/**
 * Rutas pre-auth explícitas — la captura entra directo al keypad sin pedir
 * nada (CLAUDE.md § PIN). AC-11: `/pending` también va exenta — no muestra
 * ningún dato. `/login`, `/forgot-password` y `/reset-password` ya no hacen
 * falta acá: son stubs de redirect de compatibilidad
 * (docs/mejora-auth-oauth-y-email.md § 0.1) que nunca llegan a mostrar
 * nada sensible. `/about` es la página pública de marca — cero datos de
 * usuario, nunca debe pedir PIN.
 */
const PIN_EXEMPT_PREFIXES = ["/add", "/onboarding", "/join", "/offline", "/api", "/dev", "/auth", "/pending", "/about"];

const EDIT_RECENT_WINDOW_MS = 60_000;

function isExemptPath(pathname: string): boolean {
  return PIN_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function readSessionUnlocked(): boolean {
  return typeof window !== "undefined" && window.sessionStorage.getItem(UNLOCKED_SESSION_KEY) === "1";
}

/**
 * `true` cuando el PIN no bloquearía nada ahora mismo — reusado por
 * superficies pre-auth (ej. `AccountPickerSheet` desde `/add`, C22) que
 * igual quieren ocultar saldos si el PIN está prendido y esta pestaña
 * todavía no se desbloqueó. Solo lee estado (`enabled` + sessionStorage),
 * no monta el `LockScreen` — eso es trabajo exclusivo de `PinGate`. El
 * lazy initializer de `useState` ya lee `sessionStorage` en el primer
 * render de cliente; no hace falta un efecto extra para eso.
 */
export function usePinUnlocked(): boolean {
  const enabled = usePinStore((s) => s.enabled);
  const [sessionUnlocked] = useState(readSessionUnlocked);
  return !enabled || sessionUnlocked;
}

/**
 * L6 — antes montado solo en `(app)/layout.tsx`: rutas fuera de ese árbol
 * (`/transactions/[id]/edit`, `/transactions/[id]/split`, `/accounts/new`,
 * `/accounts/[id]/edit`) quedaban completamente afuera del gate (B9) — "leer
 * revela, escribir no" es la regla, y esas rutas leen. Ahora vive en
 * `Providers`, por encima de todo, con una allowlist explícita de rutas
 * pre-auth (B9/C22).
 *
 * B14 — excepción real de 60s: el movimiento recién guardado se edita sin
 * desbloquear (CLAUDE.md § PIN). Sin esto, mover el gate acá rompería la
 * edición inmediata post-captura desde `/add` (pre-auth) hacia
 * `/transactions/[id]/edit` (bajo el gate).
 */
export function PinGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const verify = usePinStore((s) => s.verify);
  const lockedUntil = usePinStore((s) => s.lockedUntil);
  const lastSavedTxId = useCaptureRecencyStore((s) => s.lastSavedTxId);
  const lastSavedTxAt = useCaptureRecencyStore((s) => s.lastSavedTxAt);
  const enabled = usePinStore((s) => s.enabled);
  const biometricEnabled = usePinStore((s) => s.biometricEnabled);
  const biometricCredentialId = usePinStore((s) => s.biometricCredentialId);
  const [sessionUnlocked, setSessionUnlocked] = useState(readSessionUnlocked);
  const triedBiometricRef = useRef(false);
  // `Date.now()` no puede llamarse en el cuerpo del render (regla de
  // pureza) — se lee acá, en un tick de 1s, y el render solo compara
  // contra este estado. Corre siempre (no solo cuando está bloqueado):
  // la ventana de 60s de B14 es justamente lo que decide si está bloqueado.
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const exempt = isExemptPath(pathname);
  const isRecentEditOfOwnCapture =
    lastSavedTxId !== null &&
    lastSavedTxAt !== null &&
    nowMs - lastSavedTxAt < EDIT_RECENT_WINDOW_MS &&
    (pathname === `/transactions/${lastSavedTxId}/edit` || pathname === `/transactions/${lastSavedTxId}/split`);

  const unlocked = exempt || !enabled || sessionUnlocked || isRecentEditOfOwnCapture;
  const lockoutSeconds = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - nowMs) / 1000)) : 0;

  // §2 — al mostrarse el gate, si hay biometría configurada se intenta
  // UNA vez sola y en silencio: éxito desbloquea directo, sin tocar el
  // keypad; una cancelación o falla del sensor cae al PIN sin reintentar
  // sola (evita el prompt del SO reapareciendo en loop).
  const canUseBiometric = biometricEnabled && !!biometricCredentialId && lockoutSeconds === 0;

  const unlockWithBiometric = async () => {
    if (!biometricCredentialId) return;
    const ok = await verifyBiometric(biometricCredentialId);
    if (ok) {
      window.sessionStorage.setItem(UNLOCKED_SESSION_KEY, "1");
      setSessionUnlocked(true);
    }
  };

  useEffect(() => {
    if (unlocked || !canUseBiometric || triedBiometricRef.current) return;
    triedBiometricRef.current = true;
    void unlockWithBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, canUseBiometric]);

  if (unlocked) return <>{children}</>;

  return (
    <LockScreen
      lockoutSeconds={lockoutSeconds}
      onSubmit={async (pin) => {
        const ok = await verify(pin);
        if (ok) {
          window.sessionStorage.setItem(UNLOCKED_SESSION_KEY, "1");
          setSessionUnlocked(true);
        }
        return ok;
      }}
      onBiometric={canUseBiometric ? unlockWithBiometric : undefined}
      pinLength={6}
    />
  );
}
