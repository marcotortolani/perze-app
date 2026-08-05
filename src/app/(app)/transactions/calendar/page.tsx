"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState, Icon, NeedsFxBanner, Skeleton, TransactionRow, usePageHeader } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useIsCardPayment } from "@/hooks/use-card-payment";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useIsDesktop, DESKTOP_BREAKPOINT } from "@/hooks/use-is-desktop";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import { todayIso } from "@/lib/dates/today";
import { add, money, subtract, zero } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { formatDateLong, formatDateShort, formatMonthYearHeading, formatWeekdayNarrow, type Locale } from "@/i18n/formatting";
import type { TransactionRow as TransactionRecord } from "@/lib/db/schema";
import { TransactionsSummaryStrip } from "../TransactionsSummaryStrip";

type ListItem = { type: "header"; date: string; total: bigint; currency: string } | { type: "row"; tx: TransactionRecord };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  }
  return cells;
}

/** Mediodía UTC — a medianoche cualquier huso negativo formatea el día anterior (CLAUDE.md § huso horario). */
function noonUtc(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

/**
 * D5 — vista de calendario: mes en grilla con heatmap de intensidad por día y
 * los movimientos del alcance elegido al lado. Bloque D, Fase 7.
 *
 * **Alcance.** El panel arranca mostrando el mes visible completo y se
 * angosta al día que se elija en la grilla; el chip "todo el mes" (y volver a
 * tocar el mismo día) devuelve al mes. Antes el panel solo existía con un día
 * seleccionado, así que entrar al calendario no mostraba ningún movimiento.
 *
 * **Layout.** La grilla lleva un techo propio de 400px
 * (`CALENDAR_MAX_WIDTH`) y no el ancho que le entrega el shell
 * (`--content-max-width-wide`, 1200px). Las celdas son cuadradas
 * (`aspectRatio: "1"`), así que sin ese techo el mes crece de ALTO cuando
 * crece de ancho: a 1200px cada día medía ~162px y el calendario pasaba de los
 * 1000px, obligando a scrollear para ver un mes.
 *
 * **Los dos layouts tienen UN scroller vertical, pero no scrollean lo mismo.**
 * En desktop el calendario queda fijo como columna izquierda (a partir de
 * `DESKTOP_BREAKPOINT` — no `SPLIT_BREAKPOINT`, ese umbral más ancho existe
 * porque el split de `/transactions` necesita una lista legible a la
 * izquierda, y acá la izquierda está topeada en 400px) y solo scrollea la
 * columna derecha.
 *
 * En mobile scrollean los dos juntos: el scroller es la pantalla entera y el
 * calendario se va para arriba con el gesto. Antes el calendario era fijo
 * también acá y la lista se quedaba con la altura sobrante, que en un
 * teléfono chico es cero: en un iPhone SE (568px de alto, menos 56 de header
 * y 64 de tab bar quedan ~448) el mes solo ya mide ~400px —seis filas de
 * celdas cuadradas de ~49px, más la barra de mes y los días de la semana—,
 * así que el panel arrancaba con ~48px útiles y no se veía un solo
 * movimiento. No se arregla achicando el calendario: cualquier techo que deje
 * lugar a tres filas de lista deja celdas por debajo del mínimo táctil de
 * 44px. El calendario no es un encabezado fijo, es contenido.
 *
 * Lo que sí queda pegado en mobile es la franja de alcance + totales
 * (`position: sticky` dentro del mismo scroller): es una línea, sobrevive en
 * cualquier alto y mantiene visible a qué corresponden los números mientras
 * se recorre la lista.
 *
 * Consecuencia para el virtualizador: en mobile la lista NO empieza en el
 * origen del scroller, sino después del calendario y de la franja. Esa
 * distancia se mide y se le pasa como `scrollMargin` — sin eso el
 * virtualizador cree que el primer ítem está en el tope y desmonta filas que
 * todavía están a la vista. Se mide en vez de calcularse porque depende del
 * ancho del teléfono (celdas cuadradas), de cuántas filas tenga el mes y de
 * si el `NeedsFxBanner` está o no.
 */
const CALENDAR_MAX_WIDTH = 400;

export default function MovementsCalendarPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const categoryLabel = useCategoryLabel();
  const router = useRouter();
  const isDesktop = useIsDesktop(DESKTOP_BREAKPOINT);
  const { ref: fadeScrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();
  const { data: household } = useCurrentHousehold();
  const isCardPayment = useIsCardPayment(household?.id);
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: transactions, isLoading } = useTransactions(household?.id);

  // `push` y no `router.back()`: acá se llega desde el chip de la barra de
  // filtros de `/transactions`, pero también por deep link con historial vacío.
  usePageHeader({
    title: t("transactions.calendar.title"),
    onBack: () => router.push("/transactions"),
    backLabel: t("transactions.calendar.back"),
  });

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const baseCurrency = household?.baseCurrency ?? "UYU";
  const monthPrefix = `${year}-${pad(month + 1)}`;

  const monthTransactions = useMemo(
    () => (transactions ?? []).filter((tx) => tx.occurredAt.slice(0, 7) === monthPrefix).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)),
    [transactions, monthPrefix]
  );

  const totalsByDay = useMemo(() => {
    const totals = new Map<string, bigint>();
    for (const tx of transactions ?? []) {
      if (tx.kind !== "expense" || tx.amountBase === null) continue;
      const day = tx.occurredAt.slice(0, 10);
      totals.set(day, (totals.get(day) ?? 0n) + tx.amountBase);
    }
    return totals;
  }, [transactions]);

  // Lo que se ve en el panel: el mes entero, o el día elegido.
  const scoped = useMemo(
    () => (selectedDay ? monthTransactions.filter((tx) => tx.occurredAt.slice(0, 10) === selectedDay) : monthTransactions),
    [monthTransactions, selectedDay]
  );

  // Los tres totales EXCLUYEN los movimientos sin cotización — sumarlos como
  // si valieran cero da un número falso (CLAUDE.md § needs_fx). El conteo
  // excluido se declara con `NeedsFxBanner`, que muestra cuántos son y nunca
  // cuánto suman.
  const { income, expense, balance, pendingFxCount } = useMemo(() => {
    let inc = zero(baseCurrency);
    let exp = zero(baseCurrency);
    let pendingFx = 0;
    for (const tx of scoped) {
      if (tx.amountBase === null) {
        pendingFx++;
        continue;
      }
      if (tx.kind === "transfer" || tx.kind === "adjustment") continue;
      const m = money(tx.amountBase, baseCurrency);
      if (tx.kind === "income") inc = add(inc, m);
      else if (tx.kind === "expense") exp = add(exp, m);
    }
    return { income: inc, expense: exp, balance: subtract(inc, exp), pendingFxCount: pendingFx };
  }, [scoped, baseCurrency]);

  // Con el mes entero a la vista hacen falta los encabezados de día para
  // ubicarse; con un día elegido la fecha ya está arriba, en la zona sticky.
  const items = useMemo<ListItem[]>(() => {
    if (selectedDay) return scoped.map((tx) => ({ type: "row", tx }) as ListItem);
    const byDay = new Map<string, TransactionRecord[]>();
    for (const tx of scoped) {
      const day = tx.occurredAt.slice(0, 10);
      byDay.set(day, [...(byDay.get(day) ?? []), tx]);
    }
    const result: ListItem[] = [];
    for (const day of [...byDay.keys()].sort((a, b) => (a < b ? 1 : -1))) {
      const dayTx = byDay.get(day)!;
      const total = dayTx.reduce((s, tx) => (tx.kind === "transfer" || tx.amountBase === null ? s : s + (tx.kind === "income" ? tx.amountBase : -tx.amountBase)), 0n);
      result.push({ type: "header", date: day, total, currency: baseCurrency });
      for (const tx of dayTx) result.push({ type: "row", tx });
    }
    return result;
  }, [scoped, selectedDay, baseCurrency]);

  // Un solo `ref` para los dos layouts: el scroller es el `<div>` de la
  // columna derecha en desktop y el de la pantalla entera en mobile, pero
  // solo uno de los dos existe a la vez, así que `getScrollElement` no
  // necesita ramificar (y el virtualizador no se reengancha al cambiar de
  // ancho más allá de lo que ya hace React al remontar el árbol).
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // Los nodos también van a estado, no solo a un `ref`: la medición de
  // abajo tiene que correr cuando el nodo APARECE (el primer render es un
  // `Skeleton`, el scroller real monta varios renders después), y un `ref`
  // pasivo no despierta a ningún efecto. Mismo motivo que el callback ref
  // de `useScrollOverflow`.
  const [scrollerNode, setScrollerNode] = useState<HTMLDivElement | null>(null);
  const [listNode, setListNode] = useState<HTMLDivElement | null>(null);
  const scrollerRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      scrollerRef.current = node;
      fadeScrollerRef(node);
      setScrollerNode(node);
    },
    [fadeScrollerRef]
  );

  // Distancia entre el origen del scroller y el arranque de la lista: 0 en
  // desktop (la lista arranca en el tope de su columna) y el alto del
  // calendario + la franja sticky en mobile. Ver la nota de arriba.
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    if (isDesktop) {
      setScrollMargin(0);
      return;
    }
    if (!scrollerNode || !listNode) return;
    const measure = () => {
      const next = listNode.getBoundingClientRect().top - scrollerNode.getBoundingClientRect().top + scrollerNode.scrollTop;
      setScrollMargin((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    };
    measure();
    // Observa el scroller (cambia de ancho al rotar el teléfono, y con él
    // el alto de las celdas cuadradas) y todo lo que vive ANTES de la
    // lista. Observar la lista misma realimentaría: su alto cambia cuando
    // el virtualizador reacciona a este mismo valor.
    const observer = new ResizeObserver(measure);
    observer.observe(scrollerNode);
    for (const sibling of Array.from(scrollerNode.children)) {
      if (sibling !== listNode) observer.observe(sibling);
    }
    return () => observer.disconnect();
  }, [isDesktop, scrollerNode, listNode]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: (i) => (items[i]?.type === "header" ? 40 : 68),
    overscan: 8,
    scrollMargin,
  });

  const maxTotal = Math.max(1, ...[...totalsByDay.values()].map((v) => Number(v)));
  const cells = monthGrid(year, month);
  const today = todayIso();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  const dowLabels = Array.from({ length: 7 }, (_, i) =>
    formatWeekdayNarrow(locale, new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i))
  );
  const monthHeading = formatMonthYearHeading(locale, new Date(year, month, 1));

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelectedDay(null);
  };

  if (isLoading || !household) return <Skeleton height={320} style={{ maxWidth: CALENDAR_MAX_WIDTH, marginTop: 16 }} />;

  // `marginInline: auto` — el calendario está topeado en 400px y en el layout
  // de mobile ocupa el ancho entero de la pantalla, así que en un teléfono el
  // auto no hace nada. Donde sí importa es en tablet (768–1023, todavía
  // layout de mobile porque el split arranca recién en 1024): ahí la columna
  // mide ~730px, el mes se quedaba pegado a la izquierda y la lista de abajo
  // ocupaba todo el ancho. En desktop la columna del grid vale
  // `minmax(0,400px)`, o sea exactamente el ancho del calendario, y el auto
  // tampoco hace nada.
  const calendar = (
    <div className="w-full" style={{ maxWidth: CALENDAR_MAX_WIDTH, marginInline: "auto" }}>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label={t("transactions.calendar.prevMonth")}
          className="flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent"
        >
          <Icon name="chevron-left" size={20} color="var(--text-secondary)" />
        </button>
        <span className="t-body" style={{ fontWeight: 600 }}>
          {monthHeading}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label={t("transactions.calendar.nextMonth")}
          className="flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent"
        >
          <Icon name="chevron" size={20} color="var(--text-secondary)" />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {dowLabels.map((d, i) => (
          <div key={`${d}-${i}`} style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)" }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((iso, i) => {
          if (!iso) return <div key={`empty-${i}`} />;
          const total = totalsByDay.get(iso) ?? 0n;
          const intensity = total > 0n ? Math.max(0.12, Number(total) / maxTotal) : 0;
          const day = Number(iso.slice(-2));
          const dayLabel = formatDateLong(locale, noonUtc(iso));
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedDay(iso === selectedDay ? null : iso)}
              aria-pressed={iso === selectedDay}
              // El contenido accesible de la celda era el número desnudo: sin
              // fecha y sin el dato que el heatmap codifica en color.
              aria-label={total > 0n ? `${dayLabel} · ${formatAmountCompact(money(total, baseCurrency), { showSign: false })}` : dayLabel}
              style={{
                aspectRatio: "1",
                borderRadius: 10,
                border: iso === today ? "1px solid var(--primary-ink)" : selectedDay === iso ? "1px solid var(--text-secondary)" : "1px solid transparent",
                background: intensity > 0 ? `color-mix(in srgb, var(--data-1) ${Math.round(intensity * 70)}%, var(--surface-1))` : "var(--surface-1)",
                color: "var(--text-primary)",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Zona sticky: alcance + totales. Va DENTRO del scroller y no como hermano
  // de arriba para que se pegue al borde superior del scroller y no a un
  // punto de la página — en mobile eso es lo que la deja fija mientras el
  // calendario se va para arriba con el gesto.
  const summary = (
    <div style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--page)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 32 }}>
        <span className="t-label" style={{ color: "var(--text-secondary)" }}>
          {selectedDay ? formatDateLong(locale, noonUtc(selectedDay)) : monthHeading}
        </span>
        {selectedDay ? (
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              minHeight: 32,
              background: "var(--surface-2)",
              border: 0,
              borderRadius: "var(--radius-chip)",
              padding: "6px 12px",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
            }}
          >
            <Icon name="close" size={14} color="var(--text-secondary)" />
            {t("transactions.calendar.wholeMonth")}
          </button>
        ) : null}
      </div>
      <TransactionsSummaryStrip income={income} expense={expense} balance={balance} style={{ paddingTop: 10 }} />
      {/* Sin sangrado negativo: acá el banner vive dentro de una columna
          que no tiene el `padding-inline` de `<main>` del que colgarse,
          así que se queda en el ancho de la lista. */}
      <NeedsFxBanner count={pendingFxCount} style={{ borderRadius: "var(--radius-card)", marginTop: 8 }} />
    </div>
  );

  // El wrapper se renderiza siempre, con lista o vacío: es el nodo contra el
  // que se mide `scrollMargin` y tiene que ser hijo directo del scroller para
  // que el `ResizeObserver` de arriba pueda distinguirlo de sus hermanos.
  const list = (
    <div ref={setListNode}>
      {items.length === 0 ? (
        <EmptyState message={selectedDay ? t("transactions.calendar.empty") : t("transactions.calendar.emptyMonth")} />
      ) : (
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = items[virtualRow.index];
            if (!item) return null;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  // `virtualRow.start` está medido desde el origen del
                  // SCROLLER; este `transform` posiciona desde el origen de
                  // la LISTA. Restar `scrollMargin` traduce de uno al otro
                  // (en desktop vale 0 y esto es la identidad).
                  transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                }}
              >
                {item.type === "header" ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "16px 0 6px" }}>
                    <span className="t-label" style={{ color: "var(--text-secondary)" }}>{formatDateShort(locale, noonUtc(item.date))}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: item.total >= 0n ? "var(--money-positive)" : "var(--text-muted)" }}>
                      {formatAmountCompact(money(item.total, item.currency), { showSign: true })}
                    </span>
                  </div>
                ) : (
                  <TransactionRow
                    icon={(categoryById.get(item.tx.categoryId ?? "")?.icon as IconName) ?? (item.tx.kind === "adjustment" ? "circle-half-tilt" : isCardPayment(item.tx) ? "credit-card" : item.tx.kind === "transfer" ? "refresh" : "cart")}
                    merchant={
                      item.tx.categoryId && categoryById.has(item.tx.categoryId)
                        ? categoryLabel(categoryById.get(item.tx.categoryId)!)
                        : item.tx.kind === "adjustment"
                          ? t("transactions.list.reconciliation")
                          : isCardPayment(item.tx)
                            ? t("transactions.list.cardPayment")
                            : item.tx.kind === "transfer"
                              ? t("transactions.list.transfer")
                              : t("transactions.list.movement")
                    }
                    meta={accountById.get(item.tx.accountId)?.name}
                    value={money(item.tx.kind === "expense" ? -item.tx.amount : item.tx.amount, item.tx.currencyCode)}
                    secondary={
                      item.tx.currencyCode !== baseCurrency && item.tx.amountBase !== null ? formatAmountCompact(money(item.tx.amountBase, baseCurrency), { showSign: false }) : undefined
                    }
                    polarity={item.tx.kind === "income" ? "positive" : item.tx.kind === "transfer" || item.tx.kind === "adjustment" ? "neutral" : "negative"}
                    onClick={() => router.push(`/transactions?tx=${item.tx.id}`)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,400px) minmax(300px,1fr)", gap: 32, height: "100%", minHeight: 0, paddingTop: 16 }}>
        <div style={{ minWidth: 0 }}>{calendar}</div>
        <div className="scroll-fade-bottom" data-scroll-overflow={overflowing} style={{ "--scroll-fade-inset-right": "12px", minWidth: 0, height: "100%", minHeight: 0 } as CSSProperties}>
          {/* `paddingRight` (y el `--scroll-fade-inset-right` pareado arriba):
              sin eso la barra de scroll queda pegada contra el contenido —
              esta columna no hereda ningún padding del lado derecho, a
              diferencia del calendario, que toma el `padding-inline` de
              `<main>`. Mismo patrón que el `SplitGrid` de `transactions/page.tsx`.
              `overflowX: hidden` explícito: `overflow-y: auto` solo activa
              `overflow-x: auto` implícito. */}
          <div
            ref={scrollerRefCallback}
            style={{ height: "100%", minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", position: "relative", paddingRight: 12, paddingBottom: 32 }}
          >
            {summary}
            {list}
          </div>
        </div>
      </div>
    );
  }

  // Mobile: un scroller para la pantalla entera. El calendario es el primer
  // hijo y scrollea con la lista — ver la nota larga arriba. Sin
  // `scroll-fade-bottom`: el degradado marca "hay más abajo" en una columna
  // topeada, y acá el que scrollea es la página.
  return (
    <div
      ref={scrollerRefCallback}
      // El despeje del FAB va ACÁ ADENTRO y no como padding de `<main>`: esta
      // ruta entró a `OWN_SCROLLER_ROUTES` (ver `(app)/layout.tsx`). Con el
      // padding afuera, el scroller terminaba varios píxeles por encima del
      // tab bar y las filas aparecían y desaparecían contra esa línea, no
      // contra el borde de la barra — se leía como una banda opaca pegada
      // abajo. Adentro del scroller es aire real al final de la lista y las
      // filas se meten debajo del tab bar como corresponde.
      className="pb-[calc(var(--block-gap)+18px)] lg:pb-8"
      style={{
        height: "100%",
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        overscrollBehavior: "contain",
        position: "relative",
        // `marginInline` negativo + el mismo valor de vuelta como padding: el
        // borde del contenido no se mueve ni un píxel, pero la caja de scroll
        // se ensancha hasta el borde de la pantalla y la barra de scroll deja
        // de quedar pegada contra el texto (y contra el calendario). El lugar
        // sale del `--screen-padding` de `<main>`. Mismo truco que ya usa
        // `TransactionsListContent`; la alternativa —sumar padding a secas—
        // habría angostado el contenido.
        marginInline: "calc(-1 * var(--screen-padding))",
        paddingInline: "var(--screen-padding)",
      }}
    >
      {/* El aire de arriba va acá y NO como `paddingTop` del scroller:
          Chrome ancla los elementos `sticky` al borde del content box, así
          que un padding en el scroller baja la franja de totales esos mismos
          píxeles y deja una franja transparente por la que se ven pasar las
          filas de la lista. */}
      <div style={{ paddingTop: 16, marginBottom: 16 }}>{calendar}</div>
      {summary}
      {list}
    </div>
  );
}
