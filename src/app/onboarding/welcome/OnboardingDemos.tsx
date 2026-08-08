"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Icon, type IconName } from "@/design-system";
import { Amount } from "@/design-system/money/Amount";
import { money } from "@/lib/money/money";
import { useMotionIntensity } from "@/components/motion";
import { spring } from "@/lib/motion/springs";

/**
 * Las tres demos de A1 (`docs/design/bloque-a-onboarding.html` marca cada
 * card como "Demo de X en loop, 3 s"). Son contenido decorativo, no
 * componentes reutilizables del contrato: recrean el LENGUAJE VISUAL de
 * `Keypad`/`CurrencyChip`/`Switch` con marcado propio en vez de instanciar
 * esos componentes interactivos — acá no hay `onKey`/`onChange` real, y un
 * `<button>` real dentro de un loop que nadie puede tocar sería un trap de
 * foco (`aria-hidden` en el ancestro no saca al `<button>` del tab order).
 * Toda la card se pinta `aria-hidden`: lo que cuenta ya está en el título y
 * el subtítulo del slide, en texto real.
 *
 * Los colores animan por `transition` CSS plano, nunca por `animate` de
 * Motion — mismo criterio que `KeypadKey`. Motion interpola `backgroundColor`
 * numéricamente y no sabe resolver un token `var(--surface-3)`: la primera
 * vez que lo intenta se queda pegado en el último valor que sí pudo aplicar
 * (se vio en QA — una tecla quedaba violeta para siempre). CSS sí resuelve
 * custom properties nativamente, así que el swap va por `style` + una
 * transición declarada en el propio `style`. `Motion` queda para lo que sí
 * es un número real: `x`, `scale`, `opacity`.
 *
 * `minimal` no anima — un frame final estático, mismo criterio que
 * `ZMark`. `reduced` sigue el loop pero sin el desplazamiento/escala de
 * "press": solo crossfade. `full` es el gesto completo.
 */
function useLoopStep(steps: number, stepMs: number): { step: number; animated: boolean; reduced: boolean } {
  const intensity = useMotionIntensity();
  const [step, setStep] = useState(0);
  const animated = intensity !== "minimal";

  useEffect(() => {
    if (!animated) return;
    const id = setInterval(() => setStep((s) => (s + 1) % steps), stepMs);
    return () => clearInterval(id);
  }, [animated, steps, stepMs]);

  return { step: animated ? step : steps - 1, animated, reduced: intensity === "reduced" };
}

const CARD_STYLE = { flex: 1, display: "flex", flexDirection: "column" as const, justifyContent: "center", padding: "0 24px", gap: 20 };
const COLOR_TRANSITION = "background-color var(--duration-fast) var(--ease-spring-snappy), box-shadow var(--duration-fast) var(--ease-spring-snappy), color var(--duration-fast) var(--ease-spring-snappy)";

// ---------------------------------------------------------------------------
// Slide 1 — Keypad: tipea un monto dígito a dígito y "guarda".
// ---------------------------------------------------------------------------

const KEYPAD_DIGITS = ["1", "2", "5", "0"];
const KEYPAD_AMOUNTS = [1n, 12n, 125n, 1250n];
const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "⌫"],
];
// Dígito + hold + "guardado" + pausa antes de reiniciar.
const KEYPAD_STEPS = KEYPAD_DIGITS.length + 2;
const KEYPAD_STEP_MS = 450;

export function KeypadDemo() {
  const t = useTranslations();
  const { step, animated } = useLoopStep(KEYPAD_STEPS, KEYPAD_STEP_MS);
  const typing = step < KEYPAD_DIGITS.length;
  const saved = step >= KEYPAD_DIGITS.length + 1;
  const amount = KEYPAD_AMOUNTS[Math.min(step, KEYPAD_DIGITS.length - 1)] ?? 0n;
  const activeDigit = typing ? KEYPAD_DIGITS[step] : undefined;

  return (
    <div aria-hidden style={CARD_STYLE}>
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {saved ? (
          <motion.div
            initial={animated ? { opacity: 0, scale: 0.9 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring.snappy}
            style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)" }}
          >
            <Icon name="check" size={18} />
            <span className="t-label">{t("onboarding.welcome.demoSaved")}</span>
          </motion.div>
        ) : (
          <Amount value={money(amount, "UYU")} size="title" polarity="neutral" showSign={false} />
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {KEYPAD_ROWS.flat().map((key) => {
          const isActive = animated && !saved && key === activeDigit;
          return (
            <div
              key={key}
              style={{
                height: 32,
                borderRadius: "var(--radius-input)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
                background: isActive ? "var(--primary-fill)" : "var(--surface-3)",
                color: isActive ? "var(--primary-on-fill)" : "var(--text-secondary)",
                transform: isActive ? "scale(1.06)" : "scale(1)",
                transition: `${COLOR_TRANSITION}, transform var(--duration-fast) var(--ease-spring-snappy)`,
              }}
            >
              {key}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 2 — cuentas en tres monedas, una se resalta a la vez.
// ---------------------------------------------------------------------------

const CURRENCY_AMOUNTS: Array<{ currency: string; amount: bigint }> = [
  { currency: "UYU", amount: 1_240_000n },
  { currency: "USD", amount: 34_000n },
  { currency: "EUR", amount: 9_000n },
];
const CURRENCY_STEP_MS = 900;

export function CurrencyDemo() {
  const t = useTranslations();
  const labels = [t("onboarding.welcome.demoAccounts.salary"), t("onboarding.welcome.demoAccounts.savings"), t("onboarding.welcome.demoAccounts.trip")];
  const CURRENCY_ROWS = CURRENCY_AMOUNTS.map((row, i) => ({ ...row, label: labels[i] as string }));
  const { step, animated } = useLoopStep(CURRENCY_ROWS.length, CURRENCY_STEP_MS);

  return (
    <div aria-hidden style={{ ...CARD_STYLE, gap: 8 }}>
      {CURRENCY_ROWS.map((row, i) => {
        const active = animated && i === step;
        return (
          <div
            key={row.currency}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              borderRadius: "var(--radius-chip)",
              background: active ? "var(--selection-surface)" : "transparent",
              boxShadow: active ? "inset 0 0 0 1px var(--selection-ring)" : "inset 0 0 0 1px transparent",
              transition: COLOR_TRANSITION,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 500,
                  fontSize: 12,
                  color: "var(--text-primary)",
                  background: "var(--surface-3)",
                  borderRadius: "var(--radius-chip)",
                  padding: "4px 8px",
                }}
              >
                {row.currency}
              </span>
              <span className="t-label" style={{ color: "var(--text-secondary)" }}>
                {row.label}
              </span>
            </div>
            <Amount value={money(row.amount, row.currency)} size="label" polarity="neutral" showSign={false} tabular />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 3 — módulos opcionales, se van prendiendo uno a uno.
// ---------------------------------------------------------------------------

const MODULE_ICONS: IconName[] = ["wallet", "target", "invest", "users"];
// Un paso por módulo que se prende + un paso final "todo prendido" antes de reiniciar.
const MODULES_STEPS = MODULE_ICONS.length + 1;
const MODULES_STEP_MS = 650;

export function ModulesDemo() {
  const t = useTranslations();
  // Mismos labels que `morePage`/`nav` — nada nuevo que traducir a mano.
  const labels = [t("morePage.budgets"), t("morePage.goals"), t("nav.investments"), t("morePage.family")];
  const MODULES = MODULE_ICONS.map((icon, i) => ({ icon, label: labels[i] as string }));
  const { step, animated } = useLoopStep(MODULES_STEPS, MODULES_STEP_MS);
  const onCount = Math.min(step, MODULES.length);

  return (
    <div aria-hidden style={{ ...CARD_STYLE, gap: 4 }}>
      {MODULES.map((mod, i) => {
        const on = animated && i < onCount;
        return (
          <div key={mod.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 4px" }}>
            <Icon name={mod.icon} size={18} color={on ? "var(--text-primary)" : "var(--text-muted)"} />
            <span className="t-body" style={{ flex: 1, color: on ? "var(--text-primary)" : "var(--text-muted)" }}>
              {mod.label}
            </span>
            <div style={{ width: 32, height: 18, borderRadius: 999, padding: 2, display: "flex", background: on ? "var(--primary-fill)" : "var(--surface-3)", transition: COLOR_TRANSITION }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: "var(--primary-on-fill)",
                  transform: on ? "translateX(14px)" : "translateX(0)",
                  transition: "transform var(--duration-fast) var(--ease-spring-snappy)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
