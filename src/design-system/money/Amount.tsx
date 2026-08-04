"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useLocale } from "next-intl";
import { CURRENCY_SYMBOLS } from "@/lib/money/format";
import { decimalsFor } from "@/lib/money/decimals";
import type { Money } from "@/lib/money/money";
import { decimalSeparatorForLocale, numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";

const SIZES: Record<string, CSSProperties> = {
  "hero-xl": {
    fontSize: "var(--text-hero-xl-size)",
    lineHeight: "var(--text-hero-xl-line)",
    fontWeight: 600,
    letterSpacing: "var(--text-hero-xl-track)",
  },
  hero: {
    fontSize: "var(--text-hero-size)",
    lineHeight: "var(--text-hero-line)",
    fontWeight: 600,
    letterSpacing: "var(--text-hero-track)",
  },
  title: {
    fontSize: "var(--text-title-size)",
    lineHeight: "var(--text-title-line)",
    fontWeight: 600,
    letterSpacing: "var(--text-title-track)",
  },
  body: { fontSize: "var(--text-body-size)", lineHeight: "var(--text-body-line)", fontWeight: 500 },
  label: { fontSize: "var(--text-label-size)", lineHeight: "var(--text-label-line)", fontWeight: 500 },
};

/** Piso de `fit`: por debajo de 55% del tamaño nominal la cifra deja de leerse como héroe. */
export const FIT_FLOOR = 0.55;
const FIT_EPSILON = 0.01;

/**
 * Escala de fuente para que el texto entre en `containerWidth`, dado el
 * ancho medido a la escala anterior (`naturalWidthAtScale1` ya viene
 * normalizado a escala 1 — ver el call site). Pura para poder testearla
 * sin DOM. Nunca sube de 1 (no agranda una cifra chica) y nunca baja de
 * `floor` (default `FIT_FLOOR`). Devuelve `previousScale` sin cambios si
 * la diferencia es menor al epsilon, para no oscilar entre renders.
 */
export function fitScale(containerWidth: number, naturalWidthAtScale1: number, previousScale: number, floor: number = FIT_FLOOR): number {
  if (containerWidth <= 0 || naturalWidthAtScale1 <= 0) return previousScale;
  const next = Math.min(1, containerWidth / naturalWidthAtScale1);
  const clamped = Math.max(floor, next);
  return Math.abs(clamped - previousScale) < FIT_EPSILON ? previousScale : clamped;
}

export interface AmountProps {
  /** Money — bigint en unidades mínimas. Nunca un `number`: ver `docs/00-producto.md` § 2.3. */
  value: Money;
  size?: "hero-xl" | "hero" | "title" | "body" | "label" | undefined;
  /**
   * Color — independiente del signo. `negative` = tinta neutra (default
   * para gastos); `negative-emphasis` = naranja, para un gasto puntual
   * destacado; `neutral` = tinta primaria, para saldos y totales.
   * Por defecto `neutral` cuando `showSign` es `false`.
   */
  polarity?: "positive" | "negative" | "negative-emphasis" | "neutral" | undefined;
  /**
   * `false` suprime el "+" delante de un valor positivo (saldos, totales:
   * nadie escribe "+$500" en su cuenta). NUNCA suprime el "−": una cuenta
   * en descubierto tiene que verse negativa sin importar este flag — un
   * valor negativo mostrado sin signo no es "más limpio", es un número
   * falso. Independiente de `polarity`, que es solo la tinta.
   */
  showSign?: boolean | undefined;
  showArrow?: boolean | undefined;
  /** `tabular-nums` + mono: solo en columnas que tienen que alinear verticalmente. */
  tabular?: boolean | undefined;
  /** Atenúa la parte decimal — se usa en la cifra héroe del keypad. */
  mutedDecimals?: boolean | undefined;
  /** Modo privacidad: cubre la cifra con un blur — mismo tamaño exacto que el contenido real, sin saltos de layout (ver nota junto al render). */
  privacy?: boolean | undefined;
  /**
   * Encoge el `font-size` hasta `FIT_FLOOR` (55%) cuando el contenedor no
   * alcanza — un patrimonio de varios millones no cabe en 40px en un
   * teléfono angosto. Default `false`: por fuera de las cifras héroe de
   * ancho de pantalla, el `nowrap` de siempre es lo correcto. El
   * contenedor tiene que darle un ancho definido (`width: 100%` de un
   * padre con `max-width`), no uno intrínseco.
   */
  fit?: boolean | undefined;
  /** Piso de `fit` cuando el default (55%) no alcanza — ver `AmountScrubber`. */
  fitFloor?: number | undefined;
  style?: CSSProperties | undefined;
}

/**
 * El ÚNICO lugar donde se formatea plata en JSX: signo, símbolo, decimales
 * por moneda, color por polaridad, modo privacidad. Para texto plano (sin
 * JSX) usar `formatAmount`/`formatAmountCompact` de `lib/money`.
 *
 * Modo privacidad (`privacy`): la cifra real se sigue renderizando —
 * define el tamaño de la caja, así que no hay salto de layout al prender o
 * apagar el modo— pero con `visibility: hidden` (invisible y afuera del
 * árbol de accesibilidad, sin ocupar espacio distinto al que ya ocupaba).
 * Encima, una píldora con blur y degradé del mismo alto/ancho la cubre.
 * Antes esto era un `filter: blur(8px)` directo sobre los glifos: el blur
 * necesita sangría para verse prolijo y cualquier ancestro con
 * `overflow: hidden` (casi cualquier tarjeta) se la recortaba, dejando
 * manchones cortados. Acá el blur se aplica sobre una forma sólida propia
 * (la píldora), nunca sobre el texto real, así que no depende de sangría
 * ni de qué contenedor la envuelve.
 */
export function Amount({
  value,
  size = "body",
  polarity,
  showSign = true,
  showArrow = false,
  tabular = false,
  mutedDecimals = false,
  privacy = false,
  fit = false,
  fitFloor = FIT_FLOOR,
  style,
  ...rest
}: AmountProps) {
  const locale = useLocale() as Locale;
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  const negative = value.amount < 0n;
  const pol = polarity ?? (!showSign ? "neutral" : negative ? "negative" : value.amount > 0n ? "positive" : "neutral");
  const color =
    pol === "positive" ? "var(--money-positive)" : pol === "negative-emphasis" ? "var(--money-negative-emphasis)" : "var(--money-negative)";

  const decimals = decimalsFor(value.currency);
  const divisor = 10n ** BigInt(decimals);
  const absAmount = negative ? -value.amount : value.amount;
  const intPart = absAmount / divisor;
  const fracPart = decimals > 0 ? (absAmount % divisor).toString().padStart(decimals, "0") : "";
  const intFormatted = new Intl.NumberFormat(numberLocaleForUiLocale(locale)).format(intPart);

  // `negative ? "−"` no depende de `showSign` a propósito — ver el
  // comentario de la prop. Ocultar el signo negativo de un saldo real
  // (p. ej. una cuenta que quedó en descubierto) lo hacía mostrarse como
  // si tuviera ese mismo monto en positivo: no es una cifra "más limpia",
  // es una cifra falsa.
  const sign = value.amount === 0n ? "" : negative ? "−" : showSign ? "+" : "";
  const arrow = showArrow && value.amount !== 0n ? (negative ? "↓ " : "↑ ") : "";
  const symbol = CURRENCY_SYMBOLS[value.currency.toUpperCase()] ?? value.currency;

  useLayoutEffect(() => {
    if (!fit) return;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const containerWidth = outer.clientWidth;
      // El ancho renderizado es proporcional al font-size aplicado, así que
      // dividir por la escala actual recupera el ancho "natural" (100%) sin
      // necesitar un nodo de medición oculto ni un flash a tamaño completo.
      const naturalWidth = inner.scrollWidth / scale;
      setScale((prev) => fitScale(containerWidth, naturalWidth, prev, fitFloor));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [fit, fitFloor, scale, intFormatted, fracPart, symbol]);

  // Wrapper de privacidad: aplica `style`/`rest` acá cuando este termina
  // siendo el nodo más externo (`!fit && privacy`) — nunca duplicado en
  // `inner`, para no repetir `id`/`aria-*`/handlers en dos nodos del DOM.
  const innerStyle = fit || privacy ? null : style;
  const innerRest = fit || privacy ? {} : rest;

  const inner = (
    <span
      ref={innerRef}
      style={{
        fontFamily: tabular ? "var(--font-mono)" : "var(--font-sans)",
        fontVariantNumeric: tabular ? "tabular-nums" : "proportional-nums",
        color,
        whiteSpace: "nowrap",
        // `inline-block` es lo que hace que `scrollWidth` mida algo: una
        // caja `inline` (el default) siempre da 0 en Blink/WebKit cuando se
        // mide desde JS, lo que rompía TODO el mecanismo de `fit` en
        // silencio (la escala nunca bajaba de 1, sin importar el contenedor).
        ...(fit ? { display: "inline-block" } : null),
        ...SIZES[size],
        ...(fit ? { fontSize: `calc(${SIZES[size]!.fontSize} * ${scale})`, lineHeight: `calc(${SIZES[size]!.lineHeight} * ${scale})` } : null),
        // El contenido real sigue en el DOM con su tamaño real — define la
        // caja, así que el layout nunca salta al prender/apagar privacidad
        // — solo se vuelve invisible e inalcanzable (`visibility: hidden`
        // saca el nodo del árbol de accesibilidad, a diferencia de un
        // `opacity: 0`, que lo deja anunciable).
        ...(privacy ? { visibility: "hidden", userSelect: "none" } : null),
        ...innerStyle,
      }}
      {...innerRest}
    >
      {arrow}
      {sign}
      {symbol}&nbsp;{intFormatted}
      {decimals > 0 ? (
        <span style={{ color: mutedDecimals ? "var(--text-muted)" : "inherit" }}>{`${decimalSeparatorForLocale(locale)}${fracPart}`}</span>
      ) : null}
    </span>
  );

  // Píldora con blur + degradé que cubre el contenido real (`inset: 0` del
  // contenedor `position: relative` que la envuelve) — nunca `filter:
  // blur()` sobre los glifos: acá el blur cae sobre una forma sólida
  // propia, así que no necesita sangría ni depende de que el contenedor no
  // recorte, a diferencia de blurear texto directamente.
  const privacyOverlay = privacy ? (
    <span
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "var(--radius-chip)",
        filter: "blur(3px)",
        background: "linear-gradient(135deg, color-mix(in srgb, var(--text-muted) 55%, transparent) 0%, color-mix(in srgb, var(--text-muted) 22%, transparent) 100%)",
      }}
    />
  ) : null;

  if (!fit) {
    if (!privacy) return inner;
    return (
      <span style={{ position: "relative", display: "inline-block", ...style }} {...rest}>
        {inner}
        {privacyOverlay}
      </span>
    );
  }

  // `overflow: hidden` acá es real — sujeta el desborde momentáneo mientras
  // `ResizeObserver` todavía no calculó `scale` — pero la píldora de
  // privacidad NO puede vivir adentro de esa misma caja: al medir
  // exactamente el mismo tamaño (`inset: 0`), su propio blur no tenía
  // sangría hacia ningún lado y el recorte le comía el borde entero,
  // dejando un corte recto en vez de un halo prolijo (patrimonio neto,
  // bento de cuentas). Con privacidad activa, esta caja se envuelve en OTRA
  // (sin `overflow`) del mismo tamaño (`width: 100%`, cero salto) y la
  // píldora se dibuja como su hermana, no su hija — recién ahí el blur
  // tiene aire para difuminarse igual que en los montos que no usan `fit`.
  const measured = (
    <span ref={outerRef} style={{ display: "block", width: "100%", minWidth: 0, overflow: "hidden", textAlign: "inherit", ...(privacy ? null : style) }} {...(privacy ? {} : rest)}>
      {inner}
    </span>
  );

  if (!privacy) return measured;

  return (
    <span style={{ position: "relative", display: "block", width: "100%", ...style }} {...rest}>
      {measured}
      {privacyOverlay}
    </span>
  );
}
