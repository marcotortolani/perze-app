"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { diagnoseEmail, emailSchema, normalizeEmail, suggestEmail } from "@/lib/validation/email";

/**
 * Un campo de email, con las cuatro cosas que se repetían mal en cada
 * pantalla que pide uno (A2, login, recuperar contraseña, J3):
 *
 * 1. **Minúscula forzada** en las dos direcciones — el estado se normaliza
 *    en cada tecla y el campo lleva `text-transform`, así que también baja
 *    lo que pegue el autocompletado del navegador.
 * 2. **Sin capitalización del teclado.** `type="email"` no alcanza en
 *    Android: hace falta `autoCapitalize="none"` explícito.
 * 3. **Validación por Zod**, no por una regex suelta copiada tres veces.
 * 4. **El error propone la corrección** en vez de nombrarla, y aparece al
 *    salir del campo — no mientras se teclea el nombre.
 *
 * `bind` se esparce en el `Input`. Lo que la pantalla quiera agregar va
 * DESPUÉS del spread, componiendo con `onChange`/`onBlur` si hace falta
 * (p. ej. login limpia el error del servidor al tipear).
 */
export function useEmailField(initial = "") {
  const t = useTranslations();
  const [value, setValue] = useState(normalizeEmail(initial));
  const [touched, setTouched] = useState(false);

  const problem = touched ? diagnoseEmail(value) : null;
  const suggestion = suggestEmail(value) ?? t("common.emailError.example");
  const hint =
    problem === "missingAt"
      ? t("common.emailError.missingAt", { suggestion })
      : problem === "missingDomain"
        ? t("common.emailError.missingDomain", { suggestion })
        : problem === "invalid"
          ? t("common.emailError.invalid", { suggestion })
          : null;

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(normalizeEmail(e.target.value));
  const onBlur = () => setTouched(true);

  return {
    /** Siempre normalizado: es el que se manda al servidor. */
    value,
    /** `true` cuando el email está completo y bien formado. */
    valid: emailSchema.safeParse(value).success,
    hint,
    setValue: (next: string) => setValue(normalizeEmail(next)),
    onChange,
    onBlur,
    bind: {
      type: "email",
      inputMode: "email",
      autoComplete: "email",
      autoCapitalize: "none",
      autoCorrect: "off",
      spellCheck: false,
      value,
      onChange,
      onBlur,
      invalid: !!hint,
      hint: hint ?? undefined,
      style: { textTransform: "lowercase" },
    },
  } as const;
}
