"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Input, Logo } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/features/auth/password-auth";
import { signInWithPasswordAction } from "@/features/auth/sign-in-with-password.action";
import { profilesRepo } from "@/lib/repos/profiles-repo";
import { markRegistered } from "@/lib/auth/registered-cookie";
import { resolveOnboardingDestination } from "@/lib/onboarding/resolve-destination";
import { useEmailField } from "@/hooks/use-email-field";
import { purgeNavigationCaches } from "@/lib/pwa/navigation-caches";

/**
 * C7 — solución de transición (ver `docs/mejora-auth-oauth-y-email.md`):
 * destino de quien ya se registró (`perze_registered` presente, sin
 * sesión viva — `src/proxy.ts`). No está en el diseño de A2, que asume
 * login/signup indistinguibles sin contraseña; acá sí hace falta
 * distinguirlos porque el registro (`/onboarding/register`) ya fijó una.
 */
/**
 * Salida del login: navegación de documento, NUNCA `router.replace()`.
 *
 * El bug: `signInWithPasswordAction` crea la sesión **en el servidor**, así
 * que el cliente de GoTrue del navegador nunca emite `SIGNED_IN`. Y
 * `useCurrentUserId()` cachea con `staleTime: Infinity` invalidando solo
 * con ese evento, así que su valor —resuelto al cargar esta pantalla, sin
 * sesión— se queda en `null` para toda la vida de la página. Con una
 * navegación de cliente, `OnboardingGate` lee ese `null` cacheado, concluye
 * que no hay sesión y hace `router.replace("/login")`: volvés al login, con
 * el formulario vacío, sesión válida y ni un error que lo explique.
 *
 * Recargar tampoco salía, porque `/login` no reaccionaba a tener sesión
 * (ver el efecto de abajo). Navegar a mano a `/` sí funcionaba: ahí se
 * monta todo de cero y la query resuelve con la cookie.
 *
 * Una navegación de documento arranca la app entera desde las cookies —
 * cliente de Supabase, cache de TanStack Query y proxy, los tres a la vez—
 * que es exactamente lo que hace falta después de un cambio de sesión.
 */
function leave(destination: string): void {
  window.location.assign(destination);
}

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const email = useEmailField();
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Con sesión viva esta pantalla no tiene nada que ofrecer, y quedarse acá
  // es una calle sin salida: el usuario ve un formulario de acceso mientras
  // ya está autenticado, y recargar no cambia nada. Pasó de verdad —era la
  // segunda mitad del bug que arregla `leave()`— y sigue siendo el estado
  // correcto aunque aquel no vuelva: entrar a `/login` con la sesión puesta
  // (un bookmark, el historial) tiene que llevar a la app.
  useEffect(() => {
    let cancelled = false;
    void createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled && data.session) leave("/");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = email.valid && password.length > 0 && !signingIn;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSigningIn(true);
    setError(null);
    try {
      const result = await signInWithPasswordAction(email.value, password);
      if (result.errorCode) {
        setError(translateAuthError(result, t as (key: string) => string));
        return;
      }
      markRegistered();
      // Todo lo que se navegó SIN sesión quedó cacheado por el service
      // worker como la respuesta de `/` — que era el redirect a `/login`.
      // Si no se tira acá, la navegación de abajo puede servirse desde ese
      // cache y devolver a esta misma pantalla con la sesión ya creada.
      await purgeNavigationCaches();
      // La sesión ya quedó en cookies reales (Set-Cookie de la Server
      // Action); este cliente del browser las lee para seguir operando
      // como siempre — outbox, RLS, etc. — con la misma instancia de acá
      // en adelante.
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const access = user ? await profilesRepo.getOwnAccess(user.id) : null;
      if (access && access.accessStatus !== "approved") {
        window.location.assign("/pending");
        return;
      }
      // AC-1 — con household local va directo a la app; en un dispositivo
      // nuevo va a `/onboarding/restore` a bajar sus datos, sin pasar por
      // la pantalla de alta. Si el chequeo falla contra el servidor, "/"
      // deja que el gate reintente por el camino normal.
      let destination = "/";
      try {
        destination = await resolveOnboardingDestination();
      } catch {
        destination = "/";
      }
      leave(destination);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <ScreenShell style={{ padding: "48px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 32 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0 }}>
          <Logo style={{ fontSize: "var(--text-title-size)" }} />
        </h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t("login.subtitle")}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Input
          placeholder={t("login.emailPlaceholder")}
          {...email.bind}
          onChange={(e) => {
            email.onChange(e);
            setError(null);
          }}
          autoFocus
        />
        <Input
          type="password"
          autoComplete="current-password"
          placeholder={t("login.passwordPlaceholder")}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          revealable
          revealLabels={{ show: t("login.showPassword"), hide: t("login.hidePassword") }}
          invalid={!!error}
          hint={error ?? undefined}
        />

        <Button disabled={!canSubmit} onClick={handleSubmit}>
          {signingIn ? t("login.signingIn") : t("login.submit")}
        </Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => router.push("/forgot-password")}
          style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-secondary)", fontSize: 13 }}
        >
          {t("login.forgotPassword")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/onboarding")}
          style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-muted)", fontSize: 13 }}
        >
          {t("login.createAccount")}
        </button>
      </div>
    </ScreenShell>
  );
}
