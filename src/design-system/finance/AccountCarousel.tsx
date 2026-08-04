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
  style?: CSSProperties | undefined;
}

/**
 * Filas de 3 cards, cada una una permutación de {3,4,5} — asimétricas a
 * propósito (`[4,4,4]` repetido es justo el look de tabla plana que se
 * busca evitar). Filas de 2, `[5,7]`/`[7,5]`.
 *
 * Elegir CUÁL variante usar en cada fila no es libre: dos filas vecinas
 * que compartan un límite de columna dibujan una línea recta vertical
 * entre ellas — dos cards apiladas de mismo ancho en la misma posición se
 * leen como una columna de tabla, no como bento. `rowBreakpoints()` +
 * `pickRow()` más abajo garantizan que ninguna fila comparta un límite
 * con la fila inmediatamente anterior.
 */
const THREE_ROW_POOL: readonly number[][] = [
  [5, 4, 3],
  [3, 4, 5],
  [4, 5, 3],
  [3, 5, 4],
  [5, 3, 4],
  [4, 3, 5],
];
const TWO_ROW_POOL: readonly number[][] = [
  [5, 7],
  [7, 5],
];

/** Límites internos de una fila (sumas parciales, sin contar 0 ni 12: esos son el borde del grid, no un límite entre cards). */
function rowBreakpoints(row: number[]): number[] {
  const bps: number[] = [];
  let acc = 0;
  for (let i = 0; i < row.length - 1; i++) {
    acc += row[i]!;
    bps.push(acc);
  }
  return bps;
}

/**
 * Primera fila del `pool`, empezando en `startIdx` (para variar cuál se
 * usa primero entre llamados) y rotando, que NO comparta ningún límite de
 * columna con `prevBreakpoints` — la fila anterior. Con pools de 2 y 6
 * filas y como mucho 2 límites por fila, siempre hay al menos una opción
 * libre (cada valor de límite aparece en, a lo sumo, la mitad del pool);
 * el `return` final es una salvaguarda que no debería alcanzarse nunca.
 */
function pickRow(pool: readonly number[][], startIdx: number, prevBreakpoints: Set<number>): number[] {
  for (let k = 0; k < pool.length; k++) {
    const candidate = pool[(startIdx + k) % pool.length]!;
    if (!rowBreakpoints(candidate).some((bp) => prevBreakpoints.has(bp))) return candidate;
  }
  return pool[startIdx % pool.length]!;
}

/**
 * Reparte el resto de `n - c1` cards (`c1` = tamaño de la primera fila) en
 * filas de 3 y de 2 que sumen exacto 12 (las columnas del grid) cada una,
 * MAXIMIZANDO las filas de 3 — son las que dan el look bento; una fila de
 * 2 sola se lee más parecida a una tabla. `r === 1` no tiene split válido
 * (ninguna combinación de filas de 3/2 deja exactamente 1 card sobrante):
 * se descarta probando el otro tamaño de primera fila.
 */
function splitRest(r: number): { threes: number; twos: number } | null {
  if (r === 0) return { threes: 0, twos: 0 };
  if (r % 3 === 0) return { threes: r / 3, twos: 0 };
  if (r % 3 === 2) return { threes: (r - 2) / 3, twos: 1 };
  if (r < 4) return null; // r === 1: sin split válido
  return { threes: (r - 4) / 3, twos: 2 };
}

/**
 * Forma del grid de escritorio, una por cantidad de cuentas — anchos de
 * columna ELEGIDOS, no calculados a partir de cuánto mide cada saldo (eso
 * es trabajo de `assignBentoSlots()` más abajo, y solo decide QUIÉN va en
 * cada slot, nunca el ancho del slot). La primera fila lleva 2 o 3 cards y
 * es la que ancla la pantalla (`[7,5]` o `[6,3,3]`); el resto se reparte en
 * filas de 3 y de 2 vía `splitRest()`, maximizando las de 3, y cada fila
 * se elige con `pickRow()` para que nunca comparta un límite de columna
 * con la fila anterior. Con empate en cantidad de filas de 3, gana la
 * primera fila de 2 cards — dos anchos (7 y 5) en vez de tres leen mejor
 * como ancla.
 */
export function bentoLayout(n: number): number[][] {
  if (n <= 0) return [];
  if (n === 1) return [[12]];
  if (n === 2) return [[7, 5]];
  if (n === 3) return [[6, 3, 3]];

  const candidates = (
    [
      { c1: 2 as const, split: splitRest(n - 2) },
      { c1: 3 as const, split: splitRest(n - 3) },
    ] as const
  ).filter((c): c is { c1: 2 | 3; split: { threes: number; twos: number } } => c.split !== null);

  const best = candidates.reduce((a, b) => (b.split.threes > a.split.threes ? b : a));

  const rows: number[][] = [best.c1 === 2 ? [7, 5] : [6, 3, 3]];
  for (let i = 0; i < best.split.threes; i++) {
    const prev = new Set(rowBreakpoints(rows[rows.length - 1]!));
    rows.push(pickRow(THREE_ROW_POOL, i, prev));
  }
  for (let i = 0; i < best.split.twos; i++) {
    const prev = new Set(rowBreakpoints(rows[rows.length - 1]!));
    rows.push(pickRow(TWO_ROW_POOL, i, prev));
  }
  return rows;
}

/**
 * Ubica cada cuenta en un slot de `bentoLayout(accounts.length)` — el
 * contenido ORDENA, ya no mide: el saldo más largo (mismo `weight` que
 * antes, `formatAmountCompact(...).length`, el formateador canónico de
 * `<Amount>` reusado solo para medir) va al slot más ancho DE SU FILA, no
 * al slot más ancho de toda la pantalla. Así el slot angosto de una fila
 * de 3 siempre recibe el saldo más corto que le tocó compartir fila, y la
 * forma de la grilla (elegida en `bentoLayout`, no acá) nunca la deforma
 * un saldo puntual. La cuenta que cae en el slot más ancho de la fila 1
 * es, por construcción, la de mayor peso global: es la destacada.
 */
function assignBentoSlots(accounts: AccountSummary[]): { gridAccounts: AccountSummary[]; gridSpans: number[] } {
  const sorted = [...accounts].sort(
    (a, b) => formatAmountCompact(b.balance, { showSign: false }).length - formatAmountCompact(a.balance, { showSign: false }).length,
  );
  const rows = bentoLayout(sorted.length);

  const gridAccounts: AccountSummary[] = [];
  const gridSpans: number[] = [];
  let pointer = 0;
  for (const rowSpans of rows) {
    const rowAccounts = sorted.slice(pointer, pointer + rowSpans.length);
    pointer += rowSpans.length;
    // Slots de la fila ordenados de más ancho a más angosto — la cuenta
    // más pesada de la fila (rowAccounts[0], ya viene ordenada desc) va al
    // primero de esa lista, la segunda más pesada al segundo, etc.
    const slotsByWidthDesc = rowSpans.map((_, idx) => idx).sort((a, b) => rowSpans[b]! - rowSpans[a]!);
    const rowResult: AccountSummary[] = new Array(rowSpans.length);
    slotsByWidthDesc.forEach((slotIdx, rank) => {
      rowResult[slotIdx] = rowAccounts[rank]!;
    });
    gridAccounts.push(...rowResult);
    gridSpans.push(...rowSpans);
  }
  return { gridAccounts, gridSpans };
}

/**
 * Carrusel horizontal con snap de cuentas: saldo, institución, moneda,
 * país. La cuenta activa se resuelve por superficie (surface-2), nunca
 * por relleno de marca.
 */
export function AccountCarousel({ accounts = [], activeId, onSelect, privacy = false, gridOnDesktop = false, style }: AccountCarouselProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = 0;
  }, []);

  // Orden y ancho final SOLO para el grid de escritorio — el carrusel de
  // mobile respeta el orden que ya trae `accounts` (ahí el orden importa
  // para el swipe), y no tiene noción de "columna". El home es un resumen,
  // no una lista donde el orden porte significado: `assignBentoSlots`
  // decide tanto la forma de la grilla (`bentoLayout`) como quién va en
  // cada slot de esa forma.
  const { gridAccounts, gridSpans } = useMemo(() => {
    if (!gridOnDesktop) return { gridAccounts: accounts, gridSpans: [] as number[] };
    return assignBentoSlots(accounts);
  }, [accounts, gridOnDesktop]);
  const renderedAccounts = gridOnDesktop ? gridAccounts : accounts;
  // La destacada es siempre la primera del grid armado arriba — el slot
  // más ancho de la fila 1, que por construcción recibe la cuenta de
  // mayor peso. En mobile no hay noción de "destacada": el carrusel
  // muestra todas igual.
  const featuredId = gridOnDesktop ? gridAccounts[0]?.id : undefined;

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
            className="account-carousel-card"
            onClick={() => onSelect?.(a.id)}
            style={{
              scrollSnapAlign: "start",
              flex: "0 0 auto",
              // El span sale de `bentoLayout()` — nunca es simplemente
              // 3/4/5, es la forma elegida de la fila que le tocó.
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
