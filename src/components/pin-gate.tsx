"use client";

import { useEffect, useState } from "react";
import { LockScreen } from "@/design-system/systems";
import { usePinStore } from "@/stores/pin-store";

const UNLOCKED_SESSION_KEY = "perze:pinUnlocked";

/**
 * L6 — el gate se aplica acá, en el shell de `(app)/`, nunca en `/add`
 * (fuera de este árbol de rutas): la captura queda pre-auth a propósito.
 * Una vez desbloqueado, sigue desbloqueado por el resto de la pestaña —
 * volver a pedir el PIN en cada navegación sería el gate interponiéndose
 * donde no corresponde.
 */
export function PinGate({ children }: { children: React.ReactNode }) {
  const enabled = usePinStore((s) => s.enabled);
  const verify = usePinStore((s) => s.verify);
  const lockoutSecondsRemaining = usePinStore((s) => s.lockoutSecondsRemaining);
  // Independiente de `enabled`: si ya se desbloqueó esta pestaña, se lee
  // directo de `sessionStorage` sin importar cuándo termina de hidratarse
  // el store persistido de `enabled`.
  const [sessionUnlocked, setSessionUnlocked] = useState(
    () => typeof window !== "undefined" && window.sessionStorage.getItem(UNLOCKED_SESSION_KEY) === "1"
  );
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const unlocked = !enabled || sessionUnlocked;

  useEffect(() => {
    if (unlocked) return;
    const tick = () => setLockoutSeconds(lockoutSecondsRemaining());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [unlocked, lockoutSecondsRemaining]);

  if (unlocked) return <>{children}</>;

  return (
    <LockScreen
      lockoutSeconds={lockoutSeconds}
      onSubmit={async (pin) => {
        const ok = await verify(pin);
        if (ok) {
          window.sessionStorage.setItem(UNLOCKED_SESSION_KEY, "1");
          setSessionUnlocked(true);
        } else {
          setLockoutSeconds(lockoutSecondsRemaining());
        }
        return ok;
      }}
      onBiometric={undefined}
      pinLength={6}
    />
  );
}
