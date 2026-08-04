"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Amount } from "../money/Amount";
import type { Money } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";

export interface AccountSummary {
  id: string;
  institution: string;
  /** Tipo de cuenta, p. ej. "Caja de Ahorro". */
  name: string;
  balance: Money;
  country?: string | undefined;
  /**
   * CON-15: cuentas de broker en dos monedas (ej. saldo en pesos + saldo en
   * dólares de la misma cuenta) — el caller arma el segundo `<Amount>` ya
   * formateado, este componente no sabe de brokers ni decide cuándo
   * corresponde mostrarlo.
   */
  secondaryBalance?: ReactNode | undefined;
}

export interface AccountCarouselProps {
  accounts: AccountSummary[];
  activeId?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
  privacy?: boolean | undefined;
  /**
   * En desktop (`lg`, 1024px), reacomoda las cards en grid en vez de
   * carrusel — hay ancho real para mostrarlas todas juntas, sin depender de
   * un gesto de arrastre. Mobile (y cualquier caller que no lo pase, como
   * el selector de cuenta de `DetailsSheet` en captura) sigue siendo el
   * carrusel de siempre. Ver `.account-grid-lg` en `globals.css`.
   */
  gridOnDesktop?: boolean | undefined;
  /**
   * Solo con `gridOnDesktop` — la card de este id es la destacada: 5 de las
   * 12 columnas del grid (ver `computeBaseSpans()` más abajo) y el monto en
   * tamaño `title`. Se ignora en mobile (el carrusel no tiene noción de
   * "columna").
   */
  featuredId?: string | undefined;
  style?: CSSProperties | undefined;
}

const MIN_SPAN = 3;
const MAX_SPAN = 5;
// 2 columnas más que `MAX_SPAN` (el techo del resto de las cards) — sin
// esto, con montos parecidos entre "Total convertido" y la cuenta más
// grande, terminaban coincidiendo en ancho y la destacada dejaba de leerse
// como tal.
const FEATURED_SPAN = MAX_SPAN + 2;
const GRID_COLUMNS = 12;
const MAX_ABSOLUTE_SPAN = 8;

/**
 * Span "base" de cada card del grid de escritorio, uno por cuenta en el
 * mismo orden que `accounts` — decidido por CUÁNTO contenido tiene que
 * mostrar (el largo del monto formateado), no por decoración.
 * `formatAmountCompact` es el mismo formateador canónico que ya usa
 * `<Amount>`, reusado acá solo para medir el largo del string (nunca para
 * mostrarlo).
 *
 * Relativo al RANGO real de esta pantalla, no un corte de caracteres fijo:
 * un umbral absoluto es ciego a si en esta pantalla particular todos los
 * montos son parecidos, todos largos, o hay de todo — con pocas cuentas o
 * con montos atípicos (moneda con muchos dígitos, por ejemplo) un corte fijo
 * se queda corto o sobra según el caso. Acá el más corto de ESTA pantalla
 * siempre cae en el piso (`MIN_SPAN`) y el más largo en el techo
 * (`MAX_SPAN`), con el resto interpolado linealmente entre los dos — así se
 * adapta solo tanto si hay 2 cuentas como si hay 20. La destacada ("Total
 * convertido" o la primera cuenta si no hay total) queda afuera de esta
 * normalización: siempre vale `FEATURED_SPAN`, es el ancla fija de la
 * pantalla y nunca compite por espacio con el resto.
 */
function computeBaseSpans(accounts: AccountSummary[], featuredId: string | undefined): number[] {
  const weights = accounts.map((a) => formatAmountCompact(a.balance, { showSign: false }).length);
  const nonFeaturedWeights = accounts.map((a, i) => (a.id === featuredId ? null : weights[i]!)).filter((w): w is number => w !== null);
  const minW = nonFeaturedWeights.length ? Math.min(...nonFeaturedWeights) : 0;
  const maxW = nonFeaturedWeights.length ? Math.max(...nonFeaturedWeights) : 0;
  return accounts.map((a, i) => {
    if (a.id === featuredId) return FEATURED_SPAN;
    // Todos los montos miden lo mismo de largo: no hay ninguna señal de
    // contenido que las diferencie, se quedan todas en el piso — el reparto
    // de sobrante de más abajo es quien termina de darles forma según con
    // quién les toque compartir fila.
    if (maxW === minW) return MIN_SPAN;
    const t = (weights[i]! - minW) / (maxW - minW);
    return Math.round(MIN_SPAN + t * (MAX_SPAN - MIN_SPAN));
  });
}

/**
 * Reparte los spans "base" de `computeBaseSpans` en filas que suman EXACTO
 * 12 — sin esto, `grid-template-columns: repeat(12, ...)` con anchos fijos
 * por card dejaba huecos muertos al final de una fila cuando lo que
 * quedaba no llenaba las 12 columnas justo. Empaquetado goloso: acumula
 * hasta que la próxima card se pasaría de 12, cierra la fila ahí, y
 * reparte lo que sobró. `featuredIndex` (la card destacada) nunca participa
 * del reparto — es un ancla visual fija, su span final es siempre igual al
 * base, caiga en la fila que caiga (única excepción: si queda SOLA en una
 * fila, ver `distributeRemainder`).
 */
function countNonFeatured(baseSpans: number[], start: number, end: number, featuredIndex: number): number {
  let count = 0;
  for (let i = start; i < end; i++) if (i !== featuredIndex) count++;
  return count;
}

function packBentoRows(baseSpans: number[], featuredIndex: number): number[] {
  // Primero se deciden los LÍMITES de cada fila (empaquetado goloso: cierra
  // apenas la próxima card se pasaría de 12) y recién después se reparte el
  // sobrante — separarlo en dos pasadas permite corregir el límite de una
  // fila (ver el rebalanceo de abajo) antes de repartir nada.
  const rowBoundaries: number[] = [0];
  let rowSum = 0;
  for (let i = 0; i < baseSpans.length; i++) {
    const span = baseSpans[i]!;
    if (rowSum + span > GRID_COLUMNS && rowSum > 0) {
      rowBoundaries.push(i);
      rowSum = 0;
    }
    rowSum += span;
  }
  rowBoundaries.push(baseSpans.length);

  // Si la ÚLTIMA fila queda con una sola card no-destacada (el empaquetado
  // goloso la dejó sola porque la fila anterior ya había cerrado en 12),
  // esa card terminaba estirada a las 12 columnas enteras sin importar
  // cuánto contenido tuviera — una card de saldo corto se veía gigante y
  // vacía. Se la "pide prestada" a la fila anterior: se mueve el último
  // ítem de esa fila a esta, así quedan al menos 2 cards para repartirse el
  // sobrante entre sí (la de más contenido absorbe más, como siempre).
  if (rowBoundaries.length > 2) {
    const lastStart = rowBoundaries[rowBoundaries.length - 2]!;
    const lastEnd = rowBoundaries[rowBoundaries.length - 1]!;
    const prevStart = rowBoundaries[rowBoundaries.length - 3]!;
    const lastNonFeatured = countNonFeatured(baseSpans, lastStart, lastEnd, featuredIndex);
    const prevNonFeatured = countNonFeatured(baseSpans, prevStart, lastStart, featuredIndex);
    const prevHasFeatured = featuredIndex >= prevStart && featuredIndex < lastStart;
    // Robar el último ítem de la fila anterior es seguro incluso si la deja
    // con cero cards propias, siempre que esa fila conserve la destacada —
    // "solo la destacada" ya es un caso soportado (absorbe el sobrante
    // entero). Sin la destacada, robar el único ítem la dejaría vacía.
    const donorWouldBeEmpty = prevNonFeatured <= 1 && !prevHasFeatured;
    if (lastNonFeatured === 1 && prevNonFeatured >= 1 && !donorWouldBeEmpty) {
      rowBoundaries[rowBoundaries.length - 2] = lastStart - 1;
    }
  }

  const finalSpans = [...baseSpans];
  for (let r = 0; r < rowBoundaries.length - 1; r++) {
    const start = rowBoundaries[r]!;
    const end = rowBoundaries[r + 1]!;
    let rowBaseSum = 0;
    for (let i = start; i < end; i++) rowBaseSum += baseSpans[i]!;
    distributeRemainder(finalSpans, baseSpans, start, end, GRID_COLUMNS - rowBaseSum, featuredIndex);
  }
  return finalSpans;
}

/**
 * Reparto del sobrante de una fila, CONCENTRADO en la card de mayor peso —
 * no proporcional. Antes esto repartía proporcional al span base de cada
 * una: mejor que el bug original (que se lo daba a la más chica primero),
 * pero todavía le daba a una card de saldo corto ("US$ 0,00") una porción
 * real del sobrante solo para que la fila cerrara en 12 — quedaba más ancha
 * de lo que su contenido justifica. Acá el sobrante va, de a una columna,
 * a la card de mayor peso BASE que todavía no llegó a un tope razonable
 * (nunca más del doble de su propio tamaño natural, nunca más de
 * `MAX_ABSOLUTE_SPAN`); al llegar a su tope, sigue la siguiente más grande.
 * Si el pool entero llega a tope y todavía sobra (caso raro, muchas cuentas
 * de contenido parecido), se ignoran los topes — nunca puede quedar un
 * sobrante sin repartir, eso es exactamente el hueco vacío que se busca
 * evitar. Empate de peso: se reparte por turnos entre las que empatan (la
 * que menos creció hasta ahora en esta fila recibe la próxima columna), en
 * vez de que la primera en el orden se lleve siempre todo.
 */
function distributeRemainder(finalSpans: number[], baseSpans: number[], start: number, end: number, remainder: number, featuredIndex: number): void {
  if (remainder <= 0 || end <= start) return;
  const pool: number[] = [];
  for (let i = start; i < end; i++) if (i !== featuredIndex) pool.push(i);
  if (pool.length === 0) {
    // La única card de esta fila es la destacada: no hay a quién más darle
    // el sobrante. Única excepción a "la destacada nunca cambia de tamaño"
    // — evita dejar un hueco vacío cuando comparte fila con nadie.
    finalSpans[featuredIndex] = (finalSpans[featuredIndex] ?? baseSpans[featuredIndex]!) + remainder;
    return;
  }
  let left = remainder;
  let ignoreCaps = false;
  while (left > 0) {
    let bestIdx = -1;
    for (const i of pool) {
      const cap = ignoreCaps ? Infinity : Math.min(MAX_ABSOLUTE_SPAN, baseSpans[i]! * 2);
      if (finalSpans[i]! >= cap) continue;
      const better =
        bestIdx === -1 ||
        baseSpans[i]! > baseSpans[bestIdx]! ||
        (baseSpans[i] === baseSpans[bestIdx] && finalSpans[i]! < finalSpans[bestIdx]!);
      if (better) bestIdx = i;
    }
    if (bestIdx === -1) {
      if (ignoreCaps) break; // salvaguarda: no debería pasar con pool.length > 0
      ignoreCaps = true;
      continue;
    }
    finalSpans[bestIdx]!++;
    left--;
  }
}

/**
 * Carrusel horizontal con snap de cuentas: saldo, institución, moneda,
 * país. La cuenta activa se resuelve por superficie (surface-2), nunca
 * por relleno de marca.
 */
export function AccountCarousel({ accounts = [], activeId, onSelect, privacy = false, gridOnDesktop = false, featuredId, style }: AccountCarouselProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = 0;
  }, []);

  // Orden y ancho final SOLO para el grid de escritorio — el carrusel de
  // mobile respeta el orden que ya trae `accounts` (ahí el orden importa
  // para el swipe), y no tiene noción de "columna". El home es un resumen,
  // no una lista donde el orden porte significado — se ordena de más ancha
  // a más angosta puramente por estética (una cascada de tamaño decreciente
  // se lee intencional, un zigzag al azar no), y `packBentoRows` convierte
  // esos anchos "base" en los anchos finales que hacen que cada fila sume
  // exacto 12 columnas — nunca queda un hueco vacío al final de una fila.
  const { gridAccounts, gridSpans } = useMemo(() => {
    if (!gridOnDesktop) return { gridAccounts: accounts, gridSpans: [] as number[] };
    const baseSpansByAccount = computeBaseSpans(accounts, featuredId);
    const paired = accounts.map((a, i) => ({ a, base: baseSpansByAccount[i]! })).sort((x, y) => y.base - x.base);
    const sorted = paired.map((p) => p.a);
    const baseSpans = paired.map((p) => p.base);
    const featuredIndex = sorted.findIndex((a) => a.id === featuredId);
    const spans = packBentoRows(baseSpans, featuredIndex);
    return { gridAccounts: sorted, gridSpans: spans };
  }, [accounts, gridOnDesktop, featuredId]);
  const renderedAccounts = gridOnDesktop ? gridAccounts : accounts;

  // Click-and-drag con mouse (desktop): sin esto, un usuario sin trackpad ni
  // scroll horizontal solo podía mover el carrusel con Shift+rueda — nada
  // arrastrable a simple vista, a diferencia de cualquier carrusel nativo.
  // Solo `pointerType === "mouse"`: el touch ya scrollea nativo via
  // `overflow-x: auto` + `scroll-snap`, agregar el mismo manejo ahí
  // competiría con el gesto nativo del sistema.
  const [dragging, setDragging] = useState(false);
  const dragState = useRef({ startX: 0, startScrollLeft: 0, moved: false });

  return (
    <div
      ref={ref}
      // `account-carousel-track` lleva `display`/`overflow-x` — no pueden
      // vivir en el `style` inline de abajo: un inline style de React le
      // gana SIEMPRE a una clase, media query o no, así que `account-grid-lg`
      // nunca podría pisarlos en desktop si quedaran ahí.
      className={`account-carousel-track${gridOnDesktop ? " account-grid-lg" : ""}`}
      // Sin mouse/trackpad horizontal, un usuario de desktop con más
      // cuentas de las que entran no tenía forma de ver el resto: la
      // rueda vertical del mouse no mueve un `overflow-x: auto` solo, y el
      // scrollbar está oculto a propósito (`scrollbarWidth: none`, es el
      // look de un carrusel con snap, no el de una lista con scrollbar).
      // Traduce la rueda vertical a horizontal SOLO cuando el gesto viene
      // predominantemente en vertical (un trackpad que ya manda `deltaX`
      // sigue scrolleando nativo, sin este handler pisándolo).
      onWheel={(e) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        const el = ref.current;
        if (!el || el.scrollWidth <= el.clientWidth) return;
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") return;
        const el = ref.current;
        if (!el || el.scrollWidth <= el.clientWidth) return;
        dragState.current = { startX: e.clientX, startScrollLeft: el.scrollLeft, moved: false };
        setDragging(true);
        el.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        const el = ref.current;
        if (!el) return;
        const dx = e.clientX - dragState.current.startX;
        // 8px, no 2-3: un click "quieto" de mano real casi nunca es cero
        // píxeles exactos entre mousedown y mouseup — un umbral más chico
        // bloqueaba el `onClick` de la card en clicks normales, no solo en
        // arrastres de verdad.
        if (Math.abs(dx) > 8) dragState.current.moved = true;
        el.scrollLeft = dragState.current.startScrollLeft - dx;
      }}
      onPointerUp={(e) => {
        if (!dragging) return;
        setDragging(false);
        ref.current?.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => setDragging(false)}
      // Un drag real no debe además disparar el `onClick` de la cuenta que
      // quedó bajo el cursor al soltar — se frena acá, en captura, antes de
      // que llegue al botón.
      onClickCapture={(e) => {
        if (dragState.current.moved) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      style={{
        gap: 12,
        scrollSnapType: dragging ? "none" : "x mandatory",
        padding: "0 var(--screen-padding)",
        margin: "0 calc(-1 * var(--screen-padding))",
        scrollPaddingInlineStart: "var(--screen-padding)",
        scrollbarWidth: "none",
        cursor: dragging ? "grabbing" : "grab",
        userSelect: dragging ? "none" : undefined,
        ...style,
      }}
    >
      {renderedAccounts.map((a, i) => {
        const on = a.id === activeId;
        const featured = a.id === featuredId;
        return (
          <button
            key={a.id}
            type="button"
            className={`account-carousel-card${featured ? " account-carousel-card--featured" : ""}`}
            onClick={() => onSelect?.(a.id)}
            style={{
              scrollSnapAlign: "start",
              flex: "0 0 auto",
              // El span final ya viene ajustado por `packBentoRows` para
              // que cada fila sume exacto 12 — nunca es simplemente 3/4/5.
              gridColumn: gridOnDesktop ? `span ${gridSpans[i]}` : undefined,
              textAlign: "left",
              cursor: "pointer",
              background: on ? "var(--selection-surface)" : "var(--surface-1)",
              borderRadius: "var(--radius-card)",
              padding: 16,
              border: 0,
              boxShadow: on ? "inset 0 0 0 1px var(--selection-ring)" : "none",
              transition: "background var(--duration-fast) var(--ease-spring-snappy)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {a.institution}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>{a.balance.currency}</span>
            </div>
            <div style={{ marginTop: 10 }}>
              {/* `title` (no `hero`) en la destacada: le da jerarquía real
                  sobre el resto sin competir con la única cifra héroe de la
                  página (el patrimonio neto arriba) — el sistema pide una
                  sola por pantalla. `fit`: red de seguridad contra el
                  desborde — el ancho real de cada card depende del reparto
                  del bento y del viewport, ninguna heurística de anchos
                  puede ser exacta siempre; con `fit` la cifra se achica
                  (hasta 70% del tamaño nominal) en vez de cortarse. */}
              <Amount value={a.balance} size={featured ? "title" : "body"} showSign={false} polarity="neutral" privacy={privacy} fit fitFloor={0.7} />
              {a.secondaryBalance ? (
                <div style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--text-muted)" }}>
                  {a.secondaryBalance}
                </div>
              ) : null}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.name}
              {a.country ? ` · ${a.country}` : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}
