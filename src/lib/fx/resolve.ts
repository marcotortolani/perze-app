import { rateFromInteger, type ScaledRate } from "./rate";

export type FxSource = "identity" | "manual" | "api" | "inherited" | "pending";

/** Fila cruda de `fx_rates` — ver `docs/01-arquitectura-datos.md` § 2.6. */
export interface FxRateRecord {
  base: string;
  quote: string;
  /** ISO `YYYY-MM-DD` */
  asOf: string;
  provider: string;
  quoteKind: string;
  rate: ScaledRate;
  fetchedAt: string;
}

export interface FxManualOverride {
  rate: ScaledRate;
  quoteKind: string;
}

export interface FxResolution {
  source: FxSource;
  rate: ScaledRate | null;
  provider: string | null;
  quoteKind: string | null;
  asOf: string | null;
  /** El dato tiene más de un día — la app lo dice, nunca lo esconde. */
  isStale: boolean;
  /**
   * Otras variantes conocidas del mismo par (blue/CCL/tarjeta, oficial…) —
   * `resolveFxRate` no lo llena (es una función pura sobre UN resultado);
   * lo agrega `fxRepo.resolve()` con lo que trajo `/api/fx`, para que E6
   * pueda ofrecer un picker en vez de una sola cotización fija.
   */
  availableQuoteKinds?: Array<{ quoteKind: string; rate: ScaledRate; asOf: string; provider: string }> | undefined;
}

const PENDING: FxResolution = {
  source: "pending",
  rate: null,
  provider: null,
  quoteKind: null,
  asOf: null,
  isStale: false,
};

/**
 * Cadena de resolución en orden estricto — `docs/01-arquitectura-datos.md`
 * § 2.6: override manual > cotización del día > último valor conocido
 * (`inherited`) > `pending`. **Nunca** hay un quinto paso con rate = 1: un
 * `1` inventado es indistinguible de un `1` legítimo (misma moneda) y
 * corrompe el patrimonio sin dejar rastro. Función pura — no hace I/O; el
 * repo/route que la llama le pasa todo lo que ya trajo de Dexie/la API.
 */
export function resolveFxRate(params: {
  base: string;
  quote: string;
  /** ISO `YYYY-MM-DD` de la fecha del movimiento. */
  date: string;
  manualOverride?: FxManualOverride | null | undefined;
  /** Todas las cotizaciones conocidas para este par, cualquier fecha/proveedor/tipo. */
  ratesForPair: readonly FxRateRecord[];
  preferredProvider?: string | undefined;
  preferredQuoteKind?: string | undefined;
}): FxResolution {
  const { base, quote, date, manualOverride, ratesForPair, preferredProvider, preferredQuoteKind } =
    params;

  if (base === quote) {
    return { source: "identity", rate: rateFromInteger(1), provider: null, quoteKind: null, asOf: date, isStale: false };
  }

  if (manualOverride) {
    return {
      source: "manual",
      rate: manualOverride.rate,
      provider: null,
      quoteKind: manualOverride.quoteKind,
      asOf: date,
      isStale: false,
    };
  }

  const matchesPreference = (r: FxRateRecord) =>
    (preferredProvider === undefined || r.provider === preferredProvider) &&
    (preferredQuoteKind === undefined || r.quoteKind === preferredQuoteKind);

  const preferred = ratesForPair.filter(matchesPreference);
  const candidates = preferred.length > 0 ? preferred : ratesForPair;

  const todayMatch = candidates.find((r) => r.asOf === date);
  if (todayMatch) {
    return {
      source: "api",
      rate: todayMatch.rate,
      provider: todayMatch.provider,
      quoteKind: todayMatch.quoteKind,
      asOf: todayMatch.asOf,
      isStale: false,
    };
  }

  // A7 — "heredado" tiene que ser una cotización ANTERIOR a la fecha del
  // movimiento, nunca posterior: un import retroactivo (CSV, gasto
  // olvidado) heredaba antes la cotización de HOY, no la de su propia
  // fecha — en ARS, decenas de puntos de error. Sin candidatos ≤ date, no
  // hay heredado legítimo: cae a pending, no inventa nada más reciente.
  const priorCandidates = candidates.filter((r) => r.asOf <= date);
  const mostRecent = [...priorCandidates].sort((a, b) => (a.asOf < b.asOf ? 1 : -1))[0];
  if (mostRecent) {
    return {
      source: "inherited",
      rate: mostRecent.rate,
      provider: mostRecent.provider,
      quoteKind: mostRecent.quoteKind,
      asOf: mostRecent.asOf,
      isStale: true,
    };
  }

  return PENDING;
}

/**
 * Ascenso por antigüedad — la única excepción del sistema que escala por
 * tiempo (`docs/02-design-system.md` § 2.5): un `needs_fx` de más de 7 días
 * sube de `neutral` a `warning`.
 */
export function needsFxSeverity(
  pendingSinceIso: string,
  now: Date = new Date()
): "neutral" | "warning" {
  const days = (now.getTime() - new Date(pendingSinceIso).getTime()) / 86_400_000;
  return days > 7 ? "warning" : "neutral";
}
