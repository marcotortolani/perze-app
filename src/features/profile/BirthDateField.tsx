"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input, SegmentedControl } from "@/design-system";
import { ageFromBirthDate, birthDateFromAge, type BirthDatePrecision } from "@/lib/analytics/age";

export interface BirthDateValue {
  /** `YYYY-MM-DD` — el 1 de julio sintético cuando `precision === "year"`. `null` sin fecha cargada. */
  birthDate: string | null;
  precision: BirthDatePrecision | null;
}

export interface BirthDateFieldProps {
  value: BirthDateValue;
  onChange: (next: BirthDateValue) => void;
  /** Etiqueta de la sección — el resto de los textos (hints, opciones) salen de `profilePage.*`. */
  label?: string | undefined;
}

const MODES = ["exact", "year"] as const;

/**
 * Fecha de nacimiento opcional con dos modos: el día exacto o solo la
 * edad en años (A4a del onboarding y K2 en `/more/profile` comparten este
 * componente). Con la edad, `birthDateFromAge()` sintetiza el 1 de julio
 * del año correspondiente y marca `precision: "year"` — el banner de
 * cumpleaños y el recordatorio `birthdate` saben ignorar ese día porque no
 * es real (`isBirthdayToday` exige la precisión explícita).
 */
export function BirthDateField({ value, onChange, label }: BirthDateFieldProps) {
  const t = useTranslations();
  // Modo local, independiente de `value.precision`: sin fecha cargada
  // todavía no hay dato que fije el modo, así que arranca en "exact" (el
  // input más directo) sin forzar una precisión inexistente al padre.
  const [mode, setMode] = useState<BirthDatePrecision>(value.precision ?? "exact");
  const [ageInput, setAgeInput] = useState(() => (value.birthDate ? String(ageFromBirthDate(value.birthDate)) : ""));

  const handleModeChange = (id: string) => {
    const next = id as BirthDatePrecision;
    setMode(next);
    if (next === "year") {
      // exact → year: siembra la caja de edad con la edad que ya estaba cargada, no la deja en blanco.
      if (value.birthDate) {
        const age = ageFromBirthDate(value.birthDate);
        setAgeInput(String(age));
        onChange({ birthDate: birthDateFromAge(age), precision: "year" });
      }
    } else {
      // year → exact: conserva la fecha sintética como punto de partida plausible — no la borra.
      if (value.birthDate) onChange({ birthDate: value.birthDate, precision: "exact" });
    }
  };

  const handleAgeChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, "").slice(0, 3);
    setAgeInput(digitsOnly);
    if (digitsOnly === "") {
      onChange({ birthDate: null, precision: null });
      return;
    }
    const age = Number(digitsOnly);
    onChange({ birthDate: birthDateFromAge(age), precision: "year" });
  };

  const handleExactChange = (raw: string) => {
    onChange({ birthDate: raw || null, precision: raw ? "exact" : null });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {label ? <span className="t-label">{label}</span> : null}
      <SegmentedControl
        size="sm"
        emphasis="surface"
        value={mode}
        onChange={handleModeChange}
        options={MODES.map((m) => ({ id: m, label: t(`profilePage.birthPrecision.${m}`) }))}
      />
      {mode === "exact" ? (
        <Input
          label={t("profilePage.birthDate")}
          type="date"
          value={value.birthDate ?? ""}
          onChange={(e) => handleExactChange(e.target.value)}
          hint={value.birthDate ? t("profilePage.ageHint", { age: ageFromBirthDate(value.birthDate) }) : t("profilePage.birthDateHint")}
        />
      ) : (
        <Input
          label={t("profilePage.age")}
          placeholder={t("profilePage.agePlaceholder")}
          inputMode="numeric"
          maxLength={3}
          value={ageInput}
          onChange={(e) => handleAgeChange(e.target.value)}
          hint={t("profilePage.ageYearHint")}
        />
      )}
    </div>
  );
}
