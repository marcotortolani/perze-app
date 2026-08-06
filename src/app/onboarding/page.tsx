"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Icon, Input, Logo, ZMark } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { seedDemoHousehold } from "@/lib/seed/demo-household";
import { clearDemoCookie, enterDemoMode, isDemoModeActive } from "@/lib/demo/demo-mode";
import { useInvalidateHousehold } from "@/hooks/use-current-household";
import { useEmailField } from "@/hooks/use-email-field";
import { purgeNavigationCaches } from "@/lib/pwa/navigation-caches";
import { createClient } from "@/lib/supabase/client";
import { parseAuthHash } from "@/lib/auth/hash-tokens";
import { profilesRepo } from "@/lib/repos/profiles-repo";
import { resolveOnboardingDestination } from "@/lib/onboarding/resolve-destination";
import { hasSeenWelcome } from "@/lib/onboarding/welcome-flag";
import { env } from "@/env";

/**
 * A2 — auth. `CLAUDE.md` § "Orden de A2": con OAuth registrado, Google/Apple
 * son primarios y el email colapsa; sin OAuth, el email es el campo
 * primario y esos botones **no se dibujan** (ausentes, no deshabilitados —
 * un botón muerto sin credenciales se lee como una app rota).
 * `NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS` (env, no un toggle en código) es lo
 * único que hay que tocar para pasar de una rama a la otra.
 *
 * **Esto contradice a propósito la anotación 1 de
 * `docs/design/bloque-a-onboarding.html`** (línea ~356), que dice que
 * Google/Apple van "al mismo nivel visual que el link, no escondidos", con
 * el `Input` de email siempre visible. `CLAUDE.md` es autoridad 1 sobre el
 * archivo de diseño (autoridad 4) y es categórico: el email colapsa. Si
 * alguien mira el HTML del diseño y "restaura" el campo siempre visible,
 * está reabriendo esto — la decisión está en `CLAUDE.md`, no acá.
 */
const OAUTH_PROVIDERS = (env.NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter((p): p is "google" | "apple" => p === "google" || p === "apple");

export default function OnboardingAuthPage() {
  const t = useTranslations();
  const router = useRouter();
  const setField = useOnboardingStore((s) => s.setField);
  const invalidateHousehold = useInvalidateHousehold();
  const email = useEmailField();
  const [seeding, setSeeding] = useState(false);
  const [sending, setSending] = useState(false);
  // Colapso de A2 (CLAUDE.md § "Orden de A2"): sin OAuth arranca expandido
  // (es lo único que hay, y coincide con el estado de hoy sin cambios).
  // Con OAuth arranca colapsado — el disparador "Usar mi email" lo abre.
  const [emailExpanded, setEmailExpanded] = useState(OAUTH_PROVIDERS.length === 0);

  /**
   * El link del mail de verificación termina acá con los tokens en el
   * fragment (flujo implícito del verify de GoTrue — ver
   * `lib/auth/hash-tokens.ts`): el proxy no puede verlos (el fragment no
   * viaja al servidor) y el cliente PKCE no los consume solo, así que sin
   * este efecto la pantalla volvía a pedir el email a alguien que YA
   * verificó. Consume los tokens, y si hay sesión (por esto o de antes),
   * salta A2 hacia donde corresponda: `/pending` sin aprobación del
   * operador, la app si ya hay household local, o A4 para seguir el
   * registro.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const fromLink = parseAuthHash(window.location.hash);
      const searchError = new URLSearchParams(window.location.search).get("error");
      if (fromLink || searchError) {
        // Limpia URL antes de cualquier await: un remount no debe reprocesarla.
        window.history.replaceState(null, "", window.location.pathname);
      }

      if (fromLink?.kind === "error" || searchError) {
        toast.error(t("onboarding.auth.linkError"));
        if (!fromLink || fromLink.kind === "error") return;
      }

      if (fromLink?.kind === "tokens") {
        const { error } = await supabase.auth.setSession({
          access_token: fromLink.accessToken,
          refresh_token: fromLink.refreshToken,
        });
        if (error) {
          toast.error(t("onboarding.auth.linkError"));
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        // AC-6 — A1 (welcome) solo en la primera apertura de este navegador,
        // sin sesión y sin venir de un link del mail (ahí el aviso/flujo de
        // A2 manda). La decisión vivía en el layout del shell, donde quedó
        // como código muerto desde que el gate retiene el render (AC-18).
        if (!fromLink && !searchError && !hasSeenWelcome()) router.replace("/onboarding/welcome");
        return;
      }

      const access = await profilesRepo.getOwnAccess(user.id);
      if (cancelled) return;
      if (access && access.accessStatus !== "approved") {
        router.replace("/pending");
        return;
      }

      // Venía del demo y se registró: la cookie muere acá; el wipe de la
      // base anónima con los datos de ejemplo lo hace `DbOwnerSync` al ver
      // la sesión real (es quien sabe qué base está activa).
      if (isDemoModeActive()) {
        clearDemoCookie();
        router.replace("/onboarding/country");
        return;
      }

      // Lo navegado sin sesión quedó cacheado como el redirect a esta
      // pantalla, y sin tirarlo el service worker puede devolver acá a
      // alguien que ya entró.
      await purgeNavigationCaches();
      if (cancelled) return;

      // AC-9 — `resolveOnboardingDestination` consulta el servidor y puede
      // fallar (sin red, proyecto pausado). Nunca degradar en silencio a
      // A4: ese es el camino que crea un household duplicado. Se avisa y el
      // usuario se queda acá, con la pantalla utilizable.
      try {
        const destination = await resolveOnboardingDestination();
        if (cancelled) return;
        router.replace(destination);
      } catch {
        if (!cancelled) toast.error(t("onboarding.auth.checkError"));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOAuth = async (provider: "google" | "apple") => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding/country` },
    });
    if (error) toast.error(error.message);
  };

  const handleMagicLink = async () => {
    if (!email.valid || sending) return;
    setSending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.value,
        options: {
          shouldCreateUser: true,
          // Sin esto GoTrue arma el link con el `site_url` pelado
          // (`supabase/config.toml`), que vuelve como `?code=` a la raíz y
          // nunca pasa por el canje de `/auth/callback`. `next` manda de
          // vuelta a `/onboarding`, que resuelve destino real
          // (`resolveOnboardingDestination()`) — nunca directo a A4, que
          // duplicaría household en un reingreso desde otro dispositivo.
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setField("email", email.value);
      router.push("/onboarding/verify");
    } finally {
      setSending(false);
    }
  };

  const handleDemo = async () => {
    setSeeding(true);
    try {
      await seedDemoHousehold();
      enterDemoMode();
      invalidateHousehold();
      router.push("/");
    } catch {
      toast.error(t("onboarding.auth.demoError"));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <ScreenShell style={{ padding: "48px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 32 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0 }}>
          <Logo style={{ fontSize: "var(--text-title-size)" }} />
        </h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t("onboarding.auth.tagline")}
        </p>
      </div>

      <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
        <ZMark size={32} gap={10} animated variant="sweep" aria-label={t("app.name")} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {OAUTH_PROVIDERS.includes("google") ? (
          <Button variant="secondary" icon="google" onClick={() => handleOAuth("google")}>
            {t("onboarding.auth.continueWithGoogle")}
          </Button>
        ) : null}
        {OAUTH_PROVIDERS.includes("apple") ? (
          <Button variant="secondary" icon="apple" onClick={() => handleOAuth("apple")}>
            {t("onboarding.auth.continueWithApple")}
          </Button>
        ) : null}

        {OAUTH_PROVIDERS.length > 0 && emailExpanded ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("onboarding.auth.orWithEmail")}</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
        ) : null}

        {emailExpanded ? (
          <>
            <Input placeholder={t("onboarding.auth.emailPlaceholder")} autoFocus={OAUTH_PROVIDERS.length > 0} {...email.bind} />

            <Button disabled={!email.valid || sending} icon="mail" onClick={handleMagicLink}>
              {sending ? t("onboarding.auth.sendingLink") : t("onboarding.auth.sendLink")}
            </Button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEmailExpanded(true)}
            style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-secondary)", fontSize: 14, alignSelf: "center", padding: "12px 0" }}
          >
            {t("onboarding.auth.useMyEmail")}
          </button>
        )}

        {/* Login y signup son indistinguibles (CLAUDE.md § "Orden de A2"):
            el mismo `signInWithOtp` de arriba reingresa a quien ya tiene
            cuenta — `resolveOnboardingDestination()` lo manda a la app o a
            `/onboarding/restore`, nunca a un formulario aparte. */}

        {/* El invitado que no tiene el link a mano (se lo dictaron, o lo
            perdió) no tenía cómo llegar a `/join` desde ningún lado. */}
        <button
          type="button"
          onClick={() => router.push("/join")}
          style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-secondary)", fontSize: 13, alignSelf: "center" }}
        >
          {t("onboarding.auth.haveInviteCode")}
        </button>
      </div>

      <button
        type="button"
        onClick={handleDemo}
        disabled={seeding}
        style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-muted)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        <Icon name="eye" size={14} color="var(--text-muted)" />
        {seeding ? t("onboarding.auth.loadingDemo") : t("onboarding.auth.tryDemo")}
      </button>
    </ScreenShell>
  );
}
