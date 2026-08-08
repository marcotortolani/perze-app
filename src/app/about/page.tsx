import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo, ZMark } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { PageEnter } from "@/components/motion/PageEnter";
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
 * Mismo lenguaje visual que `/start` (editorial, alineado a la izquierda,
 * `ZMark` de fondo, CTA anclado a los últimos 200px con `height` fijo en
 * vez de `minHeight` — ver el comentario largo en `start/page.tsx` sobre
 * por qué `height` y no `minHeight` evita el doble-scroll). Antes era un
 * bloque de texto centrado; se unificó a pedido, ya no hace falta
 * diferenciarla de `/start` para la verificación de OAuth.
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
  const privacyLines = [t("privacyNotice.who"), t("privacyNotice.sees"), t("privacyNotice.neverSees"), t("privacyNotice.noThirdParty")];

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
          WebkitMaskImage: "radial-gradient(ellipse 80% 55% at 78% 8%, #000 0%, transparent 70%)",
          maskImage: "radial-gradient(ellipse 80% 55% at 78% 8%, #000 0%, transparent 70%)",
        }}
      />
      <div aria-hidden style={{ position: "fixed", top: -32, right: -44, zIndex: 0, pointerEvents: "none", transform: "rotate(-8deg)", opacity: 0.6 }}>
        <ZMark size={62} gap={18} />
      </div>

      <ScreenShell
        background="transparent"
        style={{ height: "calc(100svh - var(--safe-top))", padding: "24px var(--screen-padding) calc(32px + env(safe-area-inset-bottom))", position: "relative", zIndex: 1 }}
      >
        <PageEnter style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <Logo size={20} />

          <div style={{ marginTop: 56 }}>
            <p className="t-caption" style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {t("landingPage.eyebrow")}
            </p>
            <h1 className="t-hero-xl" style={{ margin: "12px 0 0", maxWidth: "12ch" }}>
              {t("publicAboutPage.headline")}
            </h1>
            <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 16, maxWidth: "34ch" }}>
              {t("app.description")}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
            {features.map((feature, i) => (
              <div
                key={feature.title}
                style={{ display: "flex", gap: 16, padding: "16px 0", borderTop: i === 0 ? "1px solid var(--border)" : undefined, borderBottom: "1px solid var(--border)" }}
              >
                <span className="t-caption" style={{ color: "var(--text-muted)", flexShrink: 0, paddingTop: 2 }}>
                  {`0${i + 1}`}
                </span>
                <div>
                  <p className="t-body" style={{ margin: 0, fontWeight: 500, color: "var(--text-primary)" }}>
                    {feature.title}
                  </p>
                  <p className="t-body" style={{ margin: "2px 0 0", color: "var(--text-secondary)" }}>
                    {feature.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 32 }}>
            <p className="t-label" style={{ margin: 0, color: "var(--text-primary)" }}>
              {t("publicAboutPage.privacyTitle")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {privacyLines.map((line) => (
                <p key={line} className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 24 }} />

          {/* `paddingBottom` en este nodo (no solo en el padding del
              `ScreenShell`): cuando el contenido de arriba (4 features +
              privacidad) excede el `height` fijo del contenedor, el
              padding-bottom del contenedor queda en el borde de SU propia
              caja — no después del contenido que se desborda. El único
              lugar donde este aire está garantizado siempre, entre o fuera
              del `height`, es acá, en el último hijo real. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}>
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
            <p className="t-caption" style={{ textAlign: "center", margin: 0, color: "var(--text-muted)" }}>
              {t("aboutPage.versionLine", { version: APP_VERSION })} · {t("publicAboutPage.license")}
            </p>
          </div>
        </PageEnter>
      </ScreenShell>
    </>
  );
}
