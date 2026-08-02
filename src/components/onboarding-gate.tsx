"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ZMark } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { isDemoModeActive } from "@/lib/demo/demo-mode";
import { REGISTERED_COOKIE_NAME, isRegisteredCookieValue } from "@/lib/auth/registered-cookie";
import { useDbOwnerStore } from "@/stores/db-owner-store";

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
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { data: household, isLoading } = useCurrentHousehold();
  const userId = useCurrentUserId();
  const dbSettled = useDbOwnerStore((s) => s.settled);
  const exempt = EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));

  // AC-18 — nada de decidir (ni de renderizar la app) hasta que la sesión
  // esté resuelta Y la base Dexie activa sea la de esta sesión: antes, en
  // un reload con sesión viva, la query de household resolvía `null`
  // contra la base anónima (DbOwnerSync todavía no había cambiado) y esto
  // mandaba a `/onboarding` — un flash de la pantalla de alta en cada
  // recarga, con vuelta a la app recién después. `undefined` de `userId`
  // sigue siendo "auth cargando", nunca dispara nada.
  const ready = dbSettled && !isLoading && userId !== undefined;
  const blocked = ready && (household === null || userId === null) && !isDemoModeActive();

  useEffect(() => {
    if (exempt || !blocked) return;
    // C7 — el bug real, encontrado en producción: `blocked` es `true` tanto
    // sin sesión como CON sesión pero sin household local (dispositivo/
    // navegador nuevo para una cuenta que ya existe). Mandar este segundo
    // caso a `/login` es un loop infinito — volver a loguearse no crea
    // ningún household local, así que `blocked` sigue `true` después de
    // cada login exitoso. Solo la ausencia real de sesión (`userId === null`)
    // consulta la cookie; con sesión viva, sigue a `/onboarding`, que ya
    // detecta la sesión existente y salta directo a `/onboarding/country`.
    router.replace(userId === null ? (readRegisteredCookie() ? "/login" : "/onboarding") : "/onboarding");
  }, [exempt, blocked, userId, router]);

  // Validando sesión/base (o redirigiendo): pantalla de carga con el ZMark
  // animado — nunca el flash del onboarding ni un blanco sin explicación.
  if (!exempt && (!ready || blocked)) {
    return (
      <div style={{ minHeight: "100svh", display: "grid", placeItems: "center", background: "var(--page)" }}>
        <ZMark size={16} gap={5} animated variant="sweep" aria-label={t("app.name")} />
      </div>
    );
  }
  return <>{children}</>;
}
