import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { APP_VERSION } from "@/lib/version";

/**
 * Página pública de marca — sin sesión, sin tab bar, indexable. Existe
 * para Google Auth Platform: la verificación de marca de OAuth exige que
 * la "Application home page" configurada sea un URL público (no detrás de
 * un login) que explique el propósito de la app, con un nombre consistente
 * con el de la pantalla de consentimiento — ver
 * `docs/mejora-auth-oauth-y-email.md` § 2. `/` no sirve para esto: sin
 * sesión, `proxy.ts` la redirige a `/onboarding` (login/signup) antes de
 * renderizar nada, así que Google no puede verificar ningún contenido ahí.
 *
 * Server component a propósito, sin "use client": es contenido estático
 * por locale, no necesita ningún hook — se sirve completo en el primer
 * response, sin depender de que el crawler ejecute JS.
 *
 * Ruta pública: agregada a `PUBLIC_PREFIXES` (`src/lib/auth/public-paths.ts`),
 * `EXEMPT_PREFIXES` (`OnboardingGate`) y `PIN_EXEMPT_PREFIXES` (`PinGate`) —
 * las tres allowlists tienen que coincidir o alguna redirige antes de que
 * esto llegue a pintar.
 */
export default async function AboutPage() {
  const t = await getTranslations();

  const features = [
    { title: t("publicAboutPage.features.localFirst.title"), body: t("publicAboutPage.features.localFirst.body") },
    { title: t("publicAboutPage.features.multiCurrency.title"), body: t("publicAboutPage.features.multiCurrency.body") },
    { title: t("publicAboutPage.features.family.title"), body: t("publicAboutPage.features.family.body") },
    { title: t("publicAboutPage.features.ownData.title"), body: t("publicAboutPage.features.ownData.body") },
  ];

  return (
    <ScreenShell style={{ padding: "48px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 40 }}>
      <div style={{ textAlign: "center" }}>
        <Logo size={22} />
        <h1 className="t-hero" style={{ margin: "16px 0 0" }}>
          {t("publicAboutPage.headline")}
        </h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 12 }}>
          {t("app.description")}
        </p>
      </div>

      <Link
        href="/onboarding"
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
        {t("publicAboutPage.cta")}
      </Link>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {features.map((feature) => (
          <div key={feature.title}>
            <h2 className="t-label" style={{ margin: 0, color: "var(--text-primary)" }}>
              {feature.title}
            </h2>
            <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 4 }}>
              {feature.body}
            </p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="t-label" style={{ margin: 0, color: "var(--text-primary)" }}>
          {t("publicAboutPage.privacyTitle")}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
            {t("privacyNotice.who")}
          </p>
          <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
            {t("privacyNotice.sees")}
          </p>
          <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
            {t("privacyNotice.neverSees")}
          </p>
          <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
            {t("privacyNotice.noThirdParty")}
          </p>
        </div>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <p className="t-caption" style={{ margin: 0, color: "var(--text-muted)" }}>
          {t("aboutPage.versionLine", { version: APP_VERSION })}
        </p>
        <p className="t-caption" style={{ margin: "4px 0 0", color: "var(--text-muted)" }}>
          {t("publicAboutPage.license")}
        </p>
      </div>
    </ScreenShell>
  );
}
