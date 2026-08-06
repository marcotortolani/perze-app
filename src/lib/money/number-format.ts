import { useFormatPreferencesStore, type DecimalSeparatorPref } from "@/stores/format-preferences-store";

export interface ResolvedSeparators {
  decimal: string;
  group: string;
}

/**
 * D53 — única fuente de verdad para separador decimal Y de miles.
 * Antes cada formateador de plata/cantidades resolvía el decimal por su
 * cuenta (`formatAmount`/`formatAmountCompact` con una copia propia,
 * `<Amount>` con otra vía `decimalSeparatorForLocale`) y el de MILES
 * siempre salía de `Intl.NumberFormat` atado al idioma de la UI, nunca al
 * ajuste de Ajustes → Formato. Con el ajuste en "coma" y la UI en inglés,
 * el resultado era "1,500,00": coma de miles (estilo en-US, porque
 * `Intl.NumberFormat("en-US")` no sabía nada del ajuste) y coma decimal
 * (que sí lo respetaba) — dos separadores iguales, ambiguo e inconsistente.
 * Acá el de miles se deriva del MISMO decimal ya resuelto (el opuesto),
 * nunca de un locale de `Intl` aparte.
 */
export function resolveSeparators(pref: DecimalSeparatorPref, defaultDecimalIsComma: boolean): ResolvedSeparators {
  const decimal = pref === "comma" ? "," : pref === "period" ? "." : defaultDecimalIsComma ? "," : ".";
  return { decimal, group: decimal === "," ? "." : "," };
}

/** Lee el store con `getState()` (no un hook) — mismo criterio que `decimalSeparatorForLocale`: se llama desde helpers de formateo puro, no solo componentes. */
export function currentSeparators(defaultDecimalIsComma: boolean): ResolvedSeparators {
  return resolveSeparators(useFormatPreferencesStore.getState().decimalSeparator, defaultDecimalIsComma);
}

/**
 * Inserta `groupChar` cada 3 dígitos desde la derecha — nunca vía
 * `Intl.NumberFormat`, que ata el agrupamiento al idioma en vez de al
 * separador ya resuelto arriba. Espera solo dígitos (sin signo): el signo
 * se antepone aparte en cada caller.
 */
export function groupDigits(digits: string, groupChar: string): string {
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    const posFromRight = digits.length - i;
    if (i > 0 && posFromRight % 3 === 0) out += groupChar;
    out += digits[i];
  }
  return out;
}
