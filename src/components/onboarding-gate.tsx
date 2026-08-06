"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ZMark } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { isDemoModeActive } from "@/lib/demo/demo-mode";
import { useDbOwnerStore } from "@/stores/db-owner-store";

// `/pending` — B1: faltaba acá, así que un usuario sin aprobar y sin
// household local (nunca llegó a completar el onboarding) rebotaba
// `/pending` → `/onboarding` → `/pending` en loop infinito, porque
// `/onboarding/page.tsx` también lo manda de vuelta a `/pending` al ver
// `access_status !== "approved"`. `/login`, `/forgot-password` y
// `/reset-password` quedan como stubs de redirect de compatibilidad
// (CLAUDE.md § convención de rutas) — ya no necesitan estar acá: sin
// sesión, `proxy.ts` los manda a `/onboarding` antes de que este gate
// cliente llegue a montarse.
const EXEMPT_PREFIXES = ["/onboarding", "/dev", "/api", "/offline", "/auth", "/join", "/pending"];

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
    // `blocked` es `true` tanto sin sesión como CON sesión pero sin
    // household local (dispositivo/navegador nuevo para una cuenta que ya
    // existe) — en los dos casos el destino es `/onboarding`: sin
    // contraseñas no hay una pantalla de "reingreso" distinta, y
    // `/onboarding` ya sabe saltar a `/onboarding/restore` cuando detecta
    // sesión existente con household remoto.
    router.replace("/onboarding");
    // `pathname` en las deps aunque no se use en el cuerpo: este efecto es
    // el ÚNICO rescate del estado `blocked`, y se dispara una sola vez por
    // transición. Si ese `replace` se pierde (por ejemplo despachado
    // mientras el router ya está procesando otra navegación), `blocked` no
    // cambia, las deps no cambian, el efecto no se vuelve a disparar y el
    // gate queda mostrando su spinner para siempre — sin salida que no sea
    // recargar a mano. Con `pathname` adentro, cualquier cambio de ruta
    // posterior lo reintenta: un fallo que se auto-cura en vez de uno que
    // exige intervención.
  }, [exempt, blocked, userId, router, pathname]);

  // Validando sesión/base (o redirigiendo): pantalla de carga con el ZMark
  // animado — nunca el flash del onboarding ni un blanco sin explicación.
  if (!exempt && (!ready || blocked)) {
    return (
      <div style={{ minHeight: "100svh", paddingTop: "var(--safe-top)", display: "grid", placeItems: "center", background: "var(--page)" }}>
        <ZMark size={16} gap={5} animated variant="sweep" aria-label={t("app.name")} />
      </div>
    );
  }
  return <>{children}</>;
}
