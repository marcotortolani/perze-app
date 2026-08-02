"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { isDemoModeActive } from "@/lib/demo/demo-mode";
import { REGISTERED_COOKIE_NAME, isRegisteredCookieValue } from "@/lib/auth/registered-cookie";

// `/pending` — B1: faltaba acá, así que un usuario sin aprobar y sin
// household local (nunca llegó a completar el onboarding) rebotaba
// `/pending` → `/onboarding` → `/pending` en loop infinito, porque
// `/onboarding/page.tsx` también lo manda de vuelta a `/pending` al ver
// `access_status !== "approved"`.
const EXEMPT_PREFIXES = ["/onboarding", "/dev", "/api", "/offline", "/auth", "/join", "/pending", "/login", "/forgot-password", "/reset-password"];

function readRegisteredCookie(): boolean {
  if (typeof document === "undefined") return false;
  const match = document.cookie.match(new RegExp(`(?:^|; )${REGISTERED_COOKIE_NAME}=([^;]*)`));
  return isRegisteredCookieValue(match?.[1]);
}

/**
 * Gate del Bloque A: sin household o sin sesión real, cualquier ruta de la
 * app real redirige a `/onboarding` — reemplaza el auto-seed de demo que
 * vivía en `useCurrentHousehold` antes de que este bloque existiera.
 *
 * B1 — antes solo miraba Dexie (`household === null`), que no sabe nada de
 * la sesión de Supabase: una sesión vencida entre navegaciones de cliente
 * (sin round-trip completo por `proxy.ts`) seguía mostrando el shell. Ahora
 * también corta cuando `useCurrentUserId()` confirma `null` (sin sesión) —
 * `undefined` sigue siendo "todavía cargando", nunca dispara el redirect.
 *
 * Excepción: modo demo (§0) — sin sesión a propósito, nunca debe rebotar.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: household, isLoading } = useCurrentHousehold();
  const userId = useCurrentUserId();
  const exempt = EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
  const blocked = !isLoading && (household === null || userId === null) && !isDemoModeActive();

  useEffect(() => {
    if (!exempt && blocked) router.replace(readRegisteredCookie() ? "/login" : "/onboarding");
  }, [exempt, blocked, router]);

  if (!exempt && blocked) return null;
  return <>{children}</>;
}
