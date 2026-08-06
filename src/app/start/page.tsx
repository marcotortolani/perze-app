import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";

/** Título/descripción propios — es la superficie que se ve al compartir el link, no la genérica del root layout. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `PERZE — ${t("landingPage.headline")}`, description: t("landingPage.subtitle") };
}

/**
 * Landing pública — el link que se comparte de afuera. `proxy.ts` manda
 * acá a cualquier visitante sin sesión que entra a "/" (el resto de las
 * rutas protegidas sin sesión siguen yendo directo a `/onboarding`, sin
 * el paso extra: un deep link ya trae intención). El CTA entra por
 * `/onboarding/welcome` — los 3 slides de A1 — no directo al formulario
 * de email de A2, así que quien llega de afuera ve primero de qué se
 * trata la app.
 *
 * Mismo patrón que `/about` (server component, sin sesión, indexable,
 * fuera del shell de `(app)/`): agregada a las tres allowlists que tienen
 * que coincidir — `PUBLIC_PREFIXES`, `EXEMPT_PREFIXES` (`OnboardingGate`),
 * `PIN_EXEMPT_PREFIXES` (`PinGate`) — o alguna redirige antes de que esto
 * llegue a pintar.
 *
 * El fondo de puntos es decorativo y SIEMPRE se pinta acá, sin pasar por
 * `data-backdrop` (opt-in, apagado por default en toda la app — un
 * visitante nuevo nunca lo activó). Recicla los mismos tokens que
 * `page-backdrop` (`--dot-gap`/`--dot-size`/`--dot-ink`, `globals.css`)
 * pero como una capa propia, para no depender del atributo global ni
 * tocar la preferencia persistida de nadie.
 */
export default async function StartPage() {
  const t = await getTranslations();

  const features = [
    { title: t("landingPage.features.fast.title"), body: t("landingPage.features.fast.body") },
    { title: t("landingPage.features.multiCurrency.title"), body: t("landingPage.features.multiCurrency.body") },
    { title: t("landingPage.features.private.title"), body: t("landingPage.features.private.body") },
  ];

  return (
    <>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, var(--dot-ink) var(--dot-size), transparent var(--dot-size))",
          backgroundSize: "var(--dot-gap) var(--dot-gap)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 40%, #000 35%, transparent 100%)",
          maskImage: "radial-gradient(ellipse 90% 70% at 50% 40%, #000 35%, transparent 100%)",
        }}
      />
      <ScreenShell background="transparent" style={{ padding: "64px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 48, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginTop: "auto" }}>
          <Logo size={22} />
          <h1 className="t-hero-xl" style={{ margin: "20px 0 0" }}>
            {t("landingPage.headline")}
          </h1>
          <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 16, maxWidth: "38ch", marginInline: "auto" }}>
            {t("landingPage.subtitle")}
          </p>
        </div>

        <Link
          href="/onboarding/welcome"
          style={{
            display: "block",
            textAlign: "center",
            height: "var(--primary-button-height)",
            lineHeight: "var(--primary-button-height)",
            borderRadius: "var(--radius-button)",
            background: "var(--primary-fill)",
            color: "var(--primary-on-fill)",
            fontWeight: 600,
            fontSize: 16,
            textDecoration: "none",
          }}
        >
          {t("landingPage.cta")}
        </Link>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: "auto" }}>
          {features.map((feature) => (
            <div key={feature.title} style={{ textAlign: "center" }}>
              <h2 className="t-label" style={{ margin: 0, color: "var(--text-primary)" }}>
                {feature.title}
              </h2>
              <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                {feature.body}
              </p>
            </div>
          ))}
        </div>

        <p className="t-caption" style={{ textAlign: "center", margin: 0, color: "var(--text-muted)" }}>
          <Link href="/about" style={{ color: "var(--text-muted)" }}>
            {t("landingPage.aboutLink")}
          </Link>
        </p>
      </ScreenShell>
    </>
  );
}
