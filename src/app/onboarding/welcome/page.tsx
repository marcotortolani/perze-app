"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { Button } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useMotionIntensity } from "@/components/motion";
import { duration } from "@/lib/motion/springs";
import { markWelcomeSeen } from "@/lib/onboarding/welcome-flag";

/** Distancia (px) o velocidad (px/s) a partir de la cual el arrastre cuenta
 *  como cambio de slide. Por debajo, el slide vuelve a su lugar. */
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;

/** Las tres claves, en orden. Literales y no un `${i}` para que el mensaje
 *  siga siendo rastreable con un grep desde `messages/*.json`. */
const SLIDES = ["one", "two", "three"] as const;

/**
 * A1 — welcome, fuera del camino crítico. Se ofrece una sola vez, solo si
 * la app se abre sin sesión y sin household todavía (ver el gate en
 * `(app)/layout.tsx`).
 *
 * Tres slides deslizables (`docs/03-prompts-wireframes.md` A1, y los tres
 * puntos del mockup en `docs/design/bloque-a-onboarding.html`). El botón
 * primario avanza hasta el último, donde pasa a ser "Empezar"; "Saltear"
 * corta en cualquier momento. Los dos terminan en A2 — `/onboarding`.
 *
 * El gesto del cuerpo es el mismo que el diseño declara para las
 * transiciones de onboarding (nota 12 del bloque A): desplazamiento
 * horizontal de 24 px y opacidad, 240 ms. Solo cambia el cuerpo; el
 * "Saltear", los puntos y el botón quedan fijos.
 */
export default function OnboardingWelcomePage() {
  const t = useTranslations();
  const router = useRouter();
  const intensity = useMotionIntensity();

  const [index, setIndex] = useState(0);
  // Hacia dónde fue el último cambio: define de qué lado entra y sale el
  // cuerpo. Sin esto, volver atrás se vería igual que avanzar.
  const [direction, setDirection] = useState(1);

  const isLast = index === SLIDES.length - 1;

  const proceed = () => {
    markWelcomeSeen();
    router.push("/onboarding");
  };

  const goTo = (next: number) => {
    if (next < 0 || next >= SLIDES.length) return;
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const goesBack = info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY;
    const goesForward = info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY;
    if (goesForward) goTo(index + 1);
    else if (goesBack) goTo(index - 1);
  };

  // `minimal` no anima: el cuerpo se reemplaza sin gesto. `reduced` funde
  // sin desplazarse; `full` funde y se desplaza los 24 px del diseño.
  const shift = intensity === "full" ? 24 : 0;
  const animated = intensity !== "minimal";

  const slide = SLIDES[index] as (typeof SLIDES)[number];
  const copy = {
    one: { title: t("onboarding.welcome.slides.one.title"), subtitle: t("onboarding.welcome.slides.one.subtitle"), demo: t("onboarding.welcome.slides.one.demo") },
    two: { title: t("onboarding.welcome.slides.two.title"), subtitle: t("onboarding.welcome.slides.two.subtitle"), demo: t("onboarding.welcome.slides.two.demo") },
    three: { title: t("onboarding.welcome.slides.three.title"), subtitle: t("onboarding.welcome.slides.three.subtitle"), demo: t("onboarding.welcome.slides.three.demo") },
  }[slide];

  // `height` y no solo el `minHeight: 100svh` que ya pone `ScreenShell`: con
  // un mínimo sin techo, el contenedor crece con el contenido y los
  // `flex-basis` de abajo nunca sienten presión para encogerse — la pantalla
  // simplemente se hace más alta y aparece el scroll. Con una altura
  // definida, el flex reparte lo que hay y nada se va del viewport.
  return (
    <ScreenShell
      style={{
        height: "calc(100svh - var(--safe-top))",
        padding: "0 var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))",
        gap: 0,
      }}
    >
      {/* 56px fijos y `flex: none`: adentro vive el target de 44×44 de
          "Saltear", que no se puede achicar ni dejar que el flex lo
          comprima cuando la pantalla es baja. */}
      <div style={{ flex: "none", height: 56, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={proceed}
          style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-secondary)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, minHeight: 44, padding: "0 8px", marginRight: -8 }}
        >
          {t("onboarding.welcome.skip")}
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {/* El cuerpo es lo único que cambia entre slides. `mode="wait"` para
            que no haya dos títulos superpuestos a mitad de camino: el que
            sale termina antes de que entre el siguiente. */}
        <div
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} / ${SLIDES.length}`}
          style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
        >
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={slide}
              custom={direction}
              initial={animated ? { opacity: 0, x: direction * shift } : false}
              animate={{ opacity: 1, x: 0 }}
              exit={animated ? { opacity: 0, x: direction * -shift } : { opacity: 1 }}
              transition={{ duration: duration.base / 1000, ease: "easeOut" }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              onDragEnd={handleDragEnd}
              style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", touchAction: "pan-y" }}
            >
              {/* Los tres huecos del diseño (80 · 40 · card de 280) son la
                  medida en 390×844. En un iPhone SE (375×667) esa suma no
                  entra y la pantalla arranca scrolleada, con el primario
                  abajo del pliegue. Se declaran como `flex-basis`: en una
                  pantalla alta dan exactamente el número del diseño, y en
                  una baja ceden en este orden —primero los huecos, después
                  la tarjeta— sin que nada se corte. */}
              <div style={{ flex: "0 1 80px", minHeight: 24 }} />
              {/* `t-hero`, 40px: es lo que dice el diseño de A1
                  (`bloque-a-onboarding.html`, 600 40px/44px). Estaba en
                  `t-hero-xl` (64px), que además de no ser lo diseñado es lo
                  que empujaba todo fuera de pantalla. */}
              <h1 className="t-hero" style={{ margin: 0, maxWidth: "300px", textWrap: "pretty" }}>
                {copy.title}
              </h1>
              <p className="t-body" style={{ margin: "16px 0 0", color: "var(--text-secondary)", maxWidth: "300px", textWrap: "pretty" }}>
                {copy.subtitle}
              </p>
              <div style={{ flex: "0 1 40px", minHeight: 16 }} />
              <div
                style={{
                  background: "var(--surface-1)",
                  borderRadius: "var(--radius-card)",
                  flex: "1 1 280px",
                  minHeight: 140,
                  maxHeight: 280,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  userSelect: "none",
                }}
              >
                {copy.demo}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* `paddingTop` para que en una pantalla baja —donde la tarjeta creció
            hasta ocupar todo lo que sobraba— los puntos no queden pegados a
            su borde. En 844 no se nota: ahí sobra espacio igual. */}
        <div style={{ marginTop: "auto", paddingTop: 16, paddingBottom: 34, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Indicador, no control: un punto de 8×4 px no llega ni cerca del
              target mínimo de 44×44, así que no se toca — se avanza con el
              botón o deslizando. Por eso queda fuera del árbol accesible:
              el `aria-label` del grupo ya dice en cuál se está. */}
          <div aria-hidden style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {SLIDES.map((key, i) => (
              <motion.span
                key={key}
                animate={{ width: i === index ? 24 : 8, opacity: 1 }}
                transition={animated ? { duration: duration.fast / 1000, ease: "easeOut" } : { duration: 0 }}
                style={{ height: 4, borderRadius: 999, background: i === index ? "var(--text-primary)" : "var(--border)" }}
              />
            ))}
          </div>
          <Button onClick={isLast ? proceed : () => goTo(index + 1)}>
            {isLast ? t("onboarding.welcome.start") : t("onboarding.welcome.next")}
          </Button>
        </div>
      </div>
    </ScreenShell>
  );
}
