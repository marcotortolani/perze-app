import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo, ZMark } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { PageEnter } from "@/components/motion/PageEnter";

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
 * Mismo lenguaje visual que `/about` (unificado a pedido — antes `/about`
 * era un bloque de texto centrado, ya no): editorial y alineado a la
 * izquierda de punta a punta, título arriba, contenido fluye top-down, CTA
 * anclado a los últimos 200px con un spacer — nada se centra verticalmente.
 * La única cifra héroe de la pantalla es el "< 5 s" que retoma la métrica
 * que define todo el producto (ver CLAUDE.md, primera línea): "la app se
 * juzga por cargar un gasto en menos de 5 segundos" — exclusiva de acá,
 * `/about` no la repite. El resto de la marca (`ZMark`, tamaño gigante y
 * recortado en la esquina) es la misma textura de identidad que usan los
 * estados vacíos, solo que a mayor escala — no es un ícono decorativo
 * nuevo.
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
          WebkitMaskImage: "radial-gradient(ellipse 80% 55% at 78% 8%, #000 0%, transparent 70%)",
          maskImage: "radial-gradient(ellipse 80% 55% at 78% 8%, #000 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: -32,
          right: -44,
          zIndex: 0,
          pointerEvents: "none",
          transform: "rotate(-8deg)",
          opacity: 0.6,
        }}
      >
        <ZMark size={62} gap={18} />
      </div>

      {/* `height`, no `minHeight`: un mínimo sin techo hace que este nodo
          RECALCULE su alto en cada evento de resize/scroll (la barra de
          Safari mobile se esconde/aparece y `100svh` cambia con ella),
          además de sumarse al `min-height: 100svh` que ya trae `body`
          (`globals.css`) y al que ya pone el wrapper de `ScreenShell` — tres
          fuentes de verdad independientes recalculando el mismo número es
          lo que se sentía como un doble scroll. Con `height` fijo hay una
          sola cuenta: el spacer de abajo (`flex:1`) reparte lo que sobra
          UNA vez, y si el contenido no entra, el documento (no este nodo)
          es el único que scrollea — mismo patrón ya probado en
          `onboarding/welcome/page.tsx`. */}
      <ScreenShell
        background="transparent"
        style={{ height: "calc(100svh - var(--safe-top))", padding: "24px var(--screen-padding) calc(32px + env(safe-area-inset-bottom))", position: "relative", zIndex: 1 }}
      >
        <PageEnter style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Logo size={20} />
            <Link href="/about" className="t-caption" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
              {t("landingPage.aboutLink")}
            </Link>
          </div>

          <div style={{ marginTop: 56 }}>
            <p className="t-caption" style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {t("landingPage.eyebrow")}
            </p>
            <h1 className="t-hero-xl" style={{ margin: "12px 0 0", maxWidth: "11ch" }}>
              {t("landingPage.headline")}
            </h1>
            <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 16, maxWidth: "34ch" }}>
              {t("landingPage.subtitle")}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 40 }}>
            <span className="t-hero-xl" style={{ lineHeight: 1 }}>
              {t("landingPage.heroStatValue")}
            </span>
            <span className="t-caption" style={{ color: "var(--text-muted)", maxWidth: "12ch" }}>
              {t("landingPage.heroStatLabel")}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
            {features.map((feature, i) => (
              <div
                key={feature.title}
                style={{
                  display: "flex",
                  gap: 16,
                  padding: "16px 0",
                  borderTop: i === 0 ? "1px solid var(--border)" : undefined,
                  borderBottom: "1px solid var(--border)",
                }}
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

          <div style={{ flex: 1, minHeight: 24 }} />

          {/* `paddingBottom` en este nodo (no solo en el padding del
              `ScreenShell`): si el contenido de arriba llegara a exceder el
              `height` fijo del contenedor (locale más largo, fuente más
              grande), el padding-bottom del contenedor queda en el borde de
              SU propia caja — no después del contenido que se desborda. El
              único lugar donde este aire está garantizado siempre, entre o
              fuera del `height`, es acá, en el último hijo real. */}
          <div style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}>
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
          </div>
        </PageEnter>
      </ScreenShell>
    </>
  );
}
