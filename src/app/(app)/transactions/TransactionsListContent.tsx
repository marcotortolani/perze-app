"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Banner, Button, EmptyState, ErrorState, Icon, Skeleton, SkeletonRow, StatusBadge, TransactionRow, usePageHeader } from "@/design-system";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import type { Locale } from "@/i18n/formatting";
import type { IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useIsCardPayment } from "@/hooks/use-card-payment";
import { useAccounts } from "@/hooks/use-accounts";
import { useScopeStore } from "@/stores/scope-store";
import { accountMatchesScope } from "@/lib/scope/match-scope";
import { useCategories } from "@/hooks/use-categories";
import { useTags } from "@/hooks/use-tags";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { useTransactionTagsFor } from "@/hooks/use-transaction-tags";
import { useInvalidateAfterTransactionWrite, useTransactions } from "@/hooks/use-transactions";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import { add, money, subtract, zero } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { usePendingMutations } from "@/lib/offline";
import { SwipeableRow } from "@/features/movements/SwipeableRow";
import { useDeleteTransactionWithUndo } from "@/features/movements/use-delete-transaction";
import { countActiveFilters, defaultMovementsFilters, MovementsFiltersSheet, type MovementsFilters } from "@/features/movements/MovementsFiltersSheet";
import { dayKeyOf, noonUtc, periodStartFor } from "@/features/movements/calendar-scope";
import { matchesNonDateFilters } from "@/features/movements/filter-predicate";
import { formatDateMedium } from "@/i18n/formatting";
import { useCalendarView } from "./use-calendar-view";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";
import { TransactionsSummaryStrip } from "./TransactionsSummaryStrip";
import type { AccountRow, TransactionRow as TransactionRecord } from "@/lib/db/schema";

type ListItem = { type: "header"; date: string; total: bigint; currency: string; count: number } | { type: "row"; tx: TransactionRecord };

/**
 * Cuánto sangra hacia afuera el resalte de la fila seleccionada, a cada lado.
 *
 * Es aire para el resalte, no para el contenido: el scroller y cada fila
 * compensan este valor con margen negativo + padding, así el texto y los
 * montos quedan exactamente en el mismo x que antes y alineados con las
 * cabeceras de día. Sale del `--screen-padding` de 20px, así que entra sin
 * tocar el layout de la pantalla.
 */
const SELECTION_BLEED = 12;

/**
 * `merchant` (arriba, en `<TransactionRow>`) ya muestra el nombre de la
 * categoría cuando no hay comercio cargado — repetirla acá abajo es
 * redundante. Con etiquetas, esta línea las muestra a ELLAS en vez de la
 * categoría (que el ícono + el título ya cubren); sin etiquetas, sigue
 * mostrando la categoría como siempre.
 */
/**
 * `recurringRuleName`: el título de la fila ya es la categoría (`merchant`
 * más arriba en el JSX) — repetirla acá abajo ("Itaú · Housing" con el
 * título ya diciendo "Housing") no suma información y encima obliga a
 * abrir el detalle para enterarse de qué recurrente es. Con el vínculo
 * disponible se prioriza el nombre de la regla, que sí distingue "2do
 * Nuevo Alquiler" de cualquier otro gasto con la misma categoría. Mismo
 * orden de prioridad que ya tenía `categoryLabel`: los tags (más
 * específicos, pueden ser varios) siguen ganando si existen.
 */
function buildMeta(tx: TransactionRecord, account: AccountRow | undefined, categoryLabel: string | undefined, transferLabel: string, tagNames: string[], reconciliationLabel: string, recurringRuleName: string | undefined): string {
  if (tx.kind === "transfer") return account ? `${account.name} · ${transferLabel}` : transferLabel;
  if (tx.kind === "adjustment") return account ? `${account.name} · ${reconciliationLabel}` : reconciliationLabel;
  const secondary = tagNames.length > 0 ? tagNames.join(", ") : (recurringRuleName ?? categoryLabel);
  return [account?.name, secondary].filter(Boolean).join(" · ");
}

export interface MovementsListContentProps {
  /**
   * La grilla del mes, cuando va DENTRO del scroller de la lista (mobile y
   * tablet). En escritorio el calendario vive en la segunda columna y esto
   * llega vacío — quién lo dibuja dónde lo decide `page.tsx`, que es el que
   * conoce el breakpoint.
   */
  calendarSlot?: ReactNode;
  /**
   * `true` cuando la vista de calendario está activa, en cualquiera de los dos
   * layouts. No es lo mismo que `calendarSlot`: en escritorio el calendario
   * está abierto pero no va acá adentro.
   */
  calendarOpen?: boolean;
  /**
   * Los filtros los tiene `page.tsx` y no esta lista: el heatmap del
   * calendario también los necesita, y con el estado acá adentro filtrar por
   * una categoría listaba una cosa y pintaba otra.
   */
  filters: MovementsFilters;
  onFiltersChange: (filters: MovementsFilters) => void;
}

/** D1/D2/D5/D6/D7 — lista de movimientos y su vista de calendario. Bloque D, Fase 7. */
export function MovementsListContent({ calendarSlot, calendarOpen = false, filters, onFiltersChange }: MovementsListContentProps) {
  const t = useTranslations();
  usePageHeader({ title: t("nav.movements") });
  const locale = useLocale() as Locale;
  const categoryLabel = useCategoryLabel();
  const router = useRouter();
  const { ref: fadeScrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();
  const searchParams = useSearchParams();
  const { data: household } = useCurrentHousehold();
  const isCardPayment = useIsCardPayment(household?.id);
  const { data: accountsRaw = [], isLoading: accountsLoading } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: tags = [] } = useTags(household?.id);
  const { data: rules = [] } = useRecurringRules(household?.id);
  const transactionsQuery = useTransactions(household?.id);
  const { data: transactionsRaw, isLoading: txLoading } = transactionsQuery;
  // El switch Personal/Compartido/Todo del header filtra acá — antes se
  // mostraba en esta pantalla (2+ miembros) sin que nada de abajo lo
  // leyera. `accounts`/`transactions`, ya filtrados, reemplazan a los
  // crudos del fetch para TODO lo que sigue (resumen, calendario, lista,
  // virtualización) sin tocar cada consumidor uno por uno.
  const scope = useScopeStore((s) => s.scope);
  const accounts = useMemo(() => accountsRaw.filter((a) => accountMatchesScope(a.visibility, scope)), [accountsRaw, scope]);
  const scopedAccountIds = useMemo(() => new Set(accounts.map((a) => a.id)), [accounts]);
  const transactions = useMemo(
    () => (transactionsRaw ?? []).filter((tx) => scopedAccountIds.has(tx.accountId) || (tx.counterAccountId && scopedAccountIds.has(tx.counterAccountId))),
    [transactionsRaw, scopedAccountIds]
  );
  const { data: transactionTagLinks } = useTransactionTagsFor((transactions ?? []).map((tx) => tx.id));
  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const recurringRuleById = useMemo(() => new Map(rules.map((rule) => [rule.id, rule])), [rules]);
  const tagIdsByTx = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of transactionTagLinks ?? []) {
      map.set(link.transactionId, [...(map.get(link.transactionId) ?? []), link.tagId]);
    }
    return map;
  }, [transactionTagLinks]);
  const tagNamesByTx = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [transactionId, tagIds] of tagIdsByTx) {
      const names = tagIds.map((tagId) => tagById.get(tagId)?.name).filter((name): name is string => !!name);
      if (names.length > 0) map.set(transactionId, names);
    }
    return map;
  }, [tagIdsByTx, tagById]);
  const invalidateTransactions = useInvalidateAfterTransactionWrite(household?.id);
  const deleteTransaction = useDeleteTransactionWithUndo(household?.id);
  const errorState = useQueryErrorState(transactionsQuery, { what: t("transactions.list.errorWhat") });
  const pending = usePendingMutations();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selection, setSelection] = useState<Set<string> | null>(null);

  // El split de dos columnas solo existe de este breakpoint para arriba, y
  // eso cambia qué significa elegir un movimiento (ver `openTransaction`).
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);

  /**
   * Abre el detalle de un movimiento como SELECCIÓN de esta misma pantalla
   * (`?tx=<id>`), no como navegación a otra ruta — ver la nota larga en
   * `page.tsx`.
   *
   * Conserva el resto de los params en vez de armar la URL desde cero: a esta
   * lista se llega con filtros en la URL desde el home (`?kind=`, `?from=`,
   * `?to=`, `?pending=`) y desde el buscador (`?category=`, `?payee=`).
   * Pisarlos al abrir un movimiento vaciaría el filtro de la lista de atrás
   * y, al cerrar, devolvería a una lista sin filtrar.
   *
   * `push` y no `replace`: el botón atrás del navegador —y el de Android en
   * la PWA— tiene que cerrar el detalle, que es el gesto con el que la gente
   * espera cerrarlo. `{ scroll: false }` para que la lista no salte al tope.
   */
  const openTransaction = useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams);

      // Tocar el movimiento que YA está abierto lo cierra. Sin esto no había
      // ninguna forma de volver a "nada seleccionado" desde la propia lista:
      // el único camino era el botón de volver del header.
      //
      // Se cierra con un `push` sin `tx` y no con `router.back()` —la
      // convención del resto del proyecto— porque un toggle tiene que ser
      // determinista: si venís de mirar el movimiento A y después el B,
      // `back()` desde B te deja en A seleccionado, que es cualquier cosa
      // menos deseleccionar. El botón de volver del header sigue usando
      // `back()`, que ahí sí es el gesto simétrico de abrir.
      if (next.get("tx") === id) {
        next.delete("tx");
      } else {
        next.set("tx", id);
        // Solo en escritorio: elegir un movimiento apaga la vista de
        // calendario, porque ahí los dos se pelean la segunda columna y gana
        // la última acción explícita (ver `openCalendar` en
        // `use-calendar-view.ts`). En móvil no hay tal pelea —el calendario
        // es contenido arriba de las filas y el detalle abre en un `Modal`
        // encima— así que apagarlo sería sacarle al usuario el mes que estaba
        // recorriendo por haber mirado un movimiento.
        //
        // El rango `from`/`to` no se toca en ningún caso: el día que se venía
        // mirando sigue filtrando la lista, con su chip para quitarlo.
        if (isSplit) next.delete("view");
      }

      const query = next.toString();
      router.push(query ? `/transactions?${query}` : "/transactions", { scroll: false });
    },
    [router, searchParams, isSplit]
  );

  // El alcance y la navegación de la vista de calendario viven en un hook
  // propio, compartido con `page.tsx`: las dos puntas lo derivan de la misma
  // URL en vez de pasarse estado.
  const calendar = useCalendarView();

  // Resultados del buscador flotante (`?category=` / `?payee=`) aterrizan
  // acá ya filtrados en vez de en una lista sin filtrar — ver `SearchOverlay`.
  const categoryIdParam = searchParams.get("category");
  const payeeIdParam = searchParams.get("payee");
  // Home ("gastado"/"ingresado este período") linkea acá con el tipo y el
  // rango del período del household ya resueltos — `from`/`to` puentean el
  // sistema de presets (que no conoce el `periodStartDay` del household)
  // en vez de forzar un preset nuevo solo para este deep link.
  const kindParam = searchParams.get("kind");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  // Home ("Tenés N movimientos sin tipo de cambio resuelto") linkea acá
  // con `?pending=1` — reusa `filters.onlyPending`, que ya filtra por
  // `fxRate === null` (el nombre del campo es viejo, de antes de que
  // `onlyPending` significara "needs_fx" y no "sync pendiente" — no se
  // renombra en este cambio para no tocar de más).
  const pendingFxParam = searchParams.get("pending");
  // El movimiento cuyo detalle se está viendo, para resaltarlo en la lista.
  // Sale del mismo param que lee `page.tsx`; no se pasa por prop porque la
  // lista ya tiene el `searchParams` a mano para sus filtros.
  const activeTxId = searchParams.get("tx");

  const accountById = useMemo(() => new Map(accounts.map((a: AccountRow) => [a.id, a])), [accounts]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const now = new Date();
  const { from, to } = fromParam ? { from: fromParam, to: toParam ?? undefined } : periodStartFor(filters.datePreset, now);

  /**
   * Todo menos el rango de fecha. Es lo que alimenta el heatmap del
   * calendario: si se calculara sobre `filtered`, elegir un día apagaría el
   * resto del mes y la visualización se borraría a sí misma. La semántica que
   * queda es la correcta — "gasto por día del mes visible, bajo los filtros
   * activos" — y el rango de fecha gobierna solo la lista.
   */
  const nonDateFiltered = useMemo(
    () => (transactions ?? []).filter((t) => matchesNonDateFilters(t, filters, tagIdsByTx, payeeIdParam)),
    [transactions, filters, payeeIdParam, tagIdsByTx]
  );

  const filtered = useMemo(
    () =>
      nonDateFiltered.filter((t) => {
        if (from && t.occurredAt < from) return false;
        if (to && t.occurredAt >= to) return false;
        return true;
      }),
    [nonDateFiltered, from, to]
  );

  // Ingresos/Gastos/Balance son el resumen del PERÍODO, no de lo que se ve
  // en la lista — solo respetan el rango de fecha (mismo concepto que
  // "gastado este período" del home). Los demás filtros (tipo, cuenta,
  // categoría, pendientes) narrowean qué se MUESTRA en la lista, y no
  // tienen por qué vaciar "ingresos" a 0 cuando el filtro activo es "gasto".
  const dateFiltered = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((t) => {
      if (from && t.occurredAt < from) return false;
      if (to && t.occurredAt >= to) return false;
      return true;
    });
  }, [transactions, from, to]);

  const baseCurrency = household?.baseCurrency ?? "UYU";
  let periodIncome = zero(baseCurrency);
  let periodExpense = zero(baseCurrency);
  for (const t of dateFiltered) {
    if (t.kind === "transfer" || t.amountBase === null) continue;
    const m = money(t.amountBase, baseCurrency);
    if (t.kind === "income") periodIncome = add(periodIncome, m);
    else if (t.kind === "expense") periodExpense = add(periodExpense, m);
  }
  const periodBalance = subtract(periodIncome, periodExpense);

  const items = useMemo<ListItem[]>(() => {
    const byDay = new Map<string, TransactionRecord[]>();
    for (const t of filtered) {
      // `dayKeyOf` y no `occurredAt.slice(0, 10)`: el slice devuelve el día en
      // UTC, así que un movimiento de la noche caía en el día siguiente en
      // cualquier huso negativo. Ahora que el calendario cuenta por día y la
      // lista filtra por rango de medianoche local, las dos puntas tienen que
      // usar la MISMA definición de "día" o tocar una celda muestra un
      // conjunto distinto del que esa celda contó.
      const day = dayKeyOf(t.occurredAt);
      const list = byDay.get(day) ?? [];
      list.push(t);
      byDay.set(day, list);
    }
    const days = [...byDay.keys()].sort((a, b) => (a < b ? 1 : -1));
    const result: ListItem[] = [];
    for (const day of days) {
      const dayTx = byDay.get(day)!;
      const dayTotal = dayTx.reduce((s, t) => (t.kind === "transfer" || t.amountBase === null ? s : s + (t.kind === "income" ? t.amountBase : -t.amountBase)), 0n);
      result.push({ type: "header", date: day, total: dayTotal, currency: baseCurrency, count: dayTx.length });
      for (const t of dayTx) result.push({ type: "row", tx: t });
    }
    return result;
  }, [filtered, baseCurrency]);

  const parentRef = useRef<HTMLDivElement>(null);
  // Los nodos van a ESTADO y no solo a un `ref`: la medición de abajo tiene
  // que correr cuando el nodo aparece, y el primer render de esta pantalla es
  // un skeleton — el scroller real monta varios renders después. Un `ref`
  // pasivo no despierta a ningún efecto. Mismo motivo que el callback ref de
  // `useScrollOverflow`.
  const [scrollerNode, setScrollerNode] = useState<HTMLDivElement | null>(null);
  const [listNode, setListNode] = useState<HTMLDivElement | null>(null);
  // `useCallback` y NO un arrow inline: con un ref inline React lo llama con
  // `null` y con el nodo en CADA render, y como acá adentro hay un `setState`
  // eso sería un loop infinito — que se ve como un cuelgue, no como un error.
  const scrollerRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      parentRef.current = node;
      fadeScrollerRef(node);
      setScrollerNode(node);
    },
    [fadeScrollerRef]
  );

  /**
   * Distancia entre el origen del scroller y el arranque de la lista.
   *
   * Vale 0 salvo cuando el calendario va adentro del scroller (mobile): ahí la
   * lista virtualizada ya no empieza en el tope, y sin esto el virtualizador
   * cree que el primer ítem está arriba de todo y desmonta filas que todavía
   * se ven. Se MIDE en vez de calcularse porque depende del ancho del teléfono
   * (las celdas del mes son cuadradas), de cuántas filas tenga el mes y del
   * alto de la franja de totales.
   */
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    if (!calendarSlot) {
      setScrollMargin(0);
      return;
    }
    if (!scrollerNode || !listNode) return;
    const measure = () => {
      const next = listNode.getBoundingClientRect().top - scrollerNode.getBoundingClientRect().top + scrollerNode.scrollTop;
      setScrollMargin((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    };
    measure();
    // Observa el scroller (cambia de ancho al rotar, y con él el alto de las
    // celdas cuadradas) y todo lo que vive ANTES de la lista. Observar la
    // lista misma realimentaría: su alto cambia cuando el virtualizador
    // reacciona a este mismo valor.
    const observer = new ResizeObserver(measure);
    observer.observe(scrollerNode);
    for (const sibling of Array.from(scrollerNode.children)) {
      if (sibling !== listNode) observer.observe(sibling);
    }
    return () => observer.disconnect();
  }, [calendarSlot, scrollerNode, listNode]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (items[i]?.type === "header" ? 40 : 68),
    overscan: 8,
    scrollMargin,
  });

  const handleDelete = (tx: TransactionRecord) => deleteTransaction(tx.id);

  const toggleSelected = (id: string) => {
    setSelection((s) => {
      const next = new Set(s ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // C24 — secuencial, no `Promise.all`: cada `softDelete`/`restore` dispara
  // un `applyBalanceDelta` sobre la MISMA cuenta cuando dos movimientos
  // seleccionados comparten `accountId` (el caso común). En paralelo, dos
  // lecturas de `current_balance` pueden pisarse (read-modify-write sin
  // lock) y perder un delta. Uno por uno es más lento pero nunca corrompe
  // el saldo.
  const handleBulkDelete = async () => {
    if (!selection) return;
    const ids = [...selection];
    for (const id of ids) {
      await transactionsRepo.softDelete(id);
    }
    invalidateTransactions();
    setSelection(null);
    toast(t("transactions.list.deletedBulk", { count: ids.length }), {
      duration: 5000,
      action: {
        label: t("transactions.list.undo"),
        onClick: async () => {
          for (const id of ids) {
            await transactionsRepo.restore(id);
          }
          invalidateTransactions();
        },
      },
    });
  };

  if (!household || accountsLoading || txLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 16 }}>
        <Skeleton width={220} height={16} style={{ marginBottom: 12 }} />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (errorState) return <ErrorState {...errorState} />;

  if ((transactions ?? []).length === 0) {
    return <EmptyState message={t("transactions.list.empty")} actionLabel={t("transactions.list.emptyAction")} onAction={() => router.push("/add")} />;
  }

  const activeFilterCount = countActiveFilters(filters, calendarOpen);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, paddingTop: 12 }}>
      {pending && pending > 0 ? (
        <Banner status="offline" pending={pending} style={{ margin: "0 calc(-1 * var(--screen-padding)) 12px", borderRadius: 0, flexShrink: 0 }} />
      ) : null}
      {/* `flexWrap`: con el calendario abierto y un día elegido son tres
          chips, y en un teléfono chico no entran en una línea. Que baje el
          tercero es prolijo; lo que no se puede es que un chip se parta por
          dentro y quede más alto que sus hermanos. `rowGap` para que las dos
          filas respiren igual que las columnas. */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, rowGap: 8, paddingBottom: 12, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-chip)", padding: "8px 14px", cursor: "pointer" }}
        >
          <Icon name="filter" size={16} color="var(--text-secondary)" />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t("transactions.list.filters")}</span>
          {activeFilterCount > 0 ? <StatusBadge status="good">{activeFilterCount}</StatusBadge> : null}
        </button>
        {/* Toggle de vista, no navegación. Antes esto empujaba a
            `/transactions/calendar`, una pantalla propia que reimplementaba
            esta misma lista; ahora el calendario es una vista de acá,
            gobernada por `?view=calendar`, y elegir un día es un rango de
            fecha sobre la lista que ya está.

            El estado activo va por superficie de selección, nunca por
            `--primary-fill`: en cada pantalla hay un solo violeta y es la
            acción primaria (acá, el FAB). */}
        <button
          type="button"
          aria-pressed={calendarOpen}
          onClick={() => (calendarOpen ? calendar.closeCalendar() : calendar.openCalendar())}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: calendarOpen ? "var(--selection-surface)" : "var(--surface-2)",
            boxShadow: calendarOpen ? "inset 0 0 0 1px var(--selection-ring)" : undefined,
            border: 0,
            borderRadius: "var(--radius-chip)",
            padding: "8px 14px",
            cursor: "pointer",
          }}
        >
          <Icon name="calendar" size={16} color={calendarOpen ? "var(--text-primary)" : "var(--text-secondary)"} />
          <span style={{ fontSize: 13, color: calendarOpen ? "var(--text-primary)" : "var(--text-secondary)" }}>{t("transactions.list.calendar")}</span>
        </button>
        {/* El alcance del día vive acá y no en la franja de totales: en
            escritorio la franja está en la otra columna, y el chip tiene que
            quedar donde se lo ve mientras se recorre la lista. Es además la
            traducción del viejo chip "todo el mes". */}
        {calendar.scope.day ? (
          <button
            type="button"
            aria-label={t("transactions.calendar.wholeMonth")}
            onClick={() => calendar.selectDay(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--surface-2)",
              border: 0,
              borderRadius: "var(--radius-chip)",
              padding: "8px 14px",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: 13,
              // Una sola línea, siempre. Con la fecha larga el chip se partía
              // en dos renglones y quedaba más alto que los de al lado; en un
              // iPhone SE directamente roto. `flexShrink: 0` para que la fila
              // de chips no lo apriete cuando no hay ancho: si algo tiene que
              // ceder, es el espacio libre de la derecha.
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {formatDateMedium(locale, noonUtc(calendar.scope.day))}
            <Icon name="close" size={14} color="var(--text-secondary)" />
          </button>
        ) : null}
        <div style={{ flex: 1 }} />
        {selection ? (
          <button type="button" onClick={() => setSelection(null)} style={{ background: "none", border: 0, color: "var(--primary-ink)", fontSize: 13, cursor: "pointer" }}>
            {t("transactions.list.cancel")}
          </button>
        ) : null}
      </div>

      {/* Wrapper propio para el fade: el scroller de abajo ya usa su
          `position:relative` para el virtualizador (anclar las filas
          absolutas), así que `scroll-fade-bottom` no puede ir ahí — necesita
          un contenedor no-scrolleable distinto. No puede ir en el root de la
          página tampoco: la barra de selección múltiple y el sheet de
          filtros son hermanos posteriores, y el fade no debe taparlos. */}
      <div className="scroll-fade-bottom" data-scroll-overflow={overflowing} style={{ "--scroll-fade-inset-right": "8px", flex: 1, minHeight: 0 } as CSSProperties}>
          <div
            // Un solo nodo, tres consumidores: el virtualizador necesita
            // `parentRef` para medir el scroll, `useScrollOverflow` necesita
            // el mismo nodo para comparar `scrollHeight`/`clientHeight`, y la
            // medición de `scrollMargin` necesita saber cuándo aparece. Un
            // `ref` de React solo acepta un valor, así que un callback ref
            // reparte — y tiene que ser `useCallback`, ver su definición.
            ref={scrollerRefCallback}
            className="pb-[calc(var(--block-gap)_+_18px)] lg:pb-8"
            // `paddingRight`: separa el texto/monto de la barra de scroll,
            // que si no queda pegada contra el borde del contenido en
            // desktop. `lg:pb-8` (32px, no 0): aire real al final de la
            // lista para el fade de arriba, igual que en `/accounts`.
            //
            // `marginInline: -SELECTION_BLEED` + el mismo valor sumado al
            // padding: el contenido queda EXACTAMENTE donde estaba (el borde
            // de contenido no se mueve ni un píxel), pero la caja de scroll
            // se ensancha hacia afuera. Eso es lo que le da lugar al resalte
            // de la fila seleccionada para sangrar sin que `overflowX:
            // hidden` lo recorte: el overflow recorta contra la caja de
            // PADDING, no contra la de contenido. El lugar sale del
            // `--screen-padding` (20px) de `<main>`, mismo truco que ya usan
            // los banners de esta pantalla con `calc(-1 * var(--screen-padding))`.
            style={{
              height: "100%",
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              overscrollBehavior: "contain",
              position: "relative",
              marginInline: -SELECTION_BLEED,
              paddingLeft: SELECTION_BLEED,
              paddingRight: SELECTION_BLEED + 8,
            }}
          >
            {/* El calendario scrollea CON la lista: en un teléfono chico no
                entran los dos a la vez, y fijarlo dejaba a la lista con la
                altura sobrante, que a 568px de alto es cero. No se arregla
                achicando el mes — cualquier techo que deje lugar a tres filas
                de lista pone las celdas por debajo del mínimo táctil de 44px.
                El calendario no es un encabezado fijo, es contenido. */}
            {calendarSlot ? <div style={{ paddingBottom: 16 }}>{calendarSlot}</div> : null}

            {/* La franja de totales sí queda pegada: es una línea, sobrevive
                en cualquier alto y mantiene visible a qué corresponden los
                números mientras se recorre la lista. Va DENTRO del scroller
                para pegarse a su borde y no a un punto de la página. El
                sangrado compensa el `marginInline` negativo del scroller: sin
                eso el fondo no llega al canal de selección y se ven pasar las
                filas por los costados. */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                background: "var(--page)",
                marginInline: -SELECTION_BLEED,
                paddingInline: SELECTION_BLEED,
              }}
            >
              <TransactionsSummaryStrip income={periodIncome} expense={periodExpense} balance={periodBalance} />
            </div>

            {/* El wrapper se renderiza SIEMPRE, con lista o vacío: es el nodo
                contra el que se mide `scrollMargin` y tiene que ser hijo
                directo del scroller para que el `ResizeObserver` pueda
                distinguirlo de sus hermanos. Y el estado vacío va acá adentro
                y no en lugar del scroller: si no, un día sin movimientos
                borraría el calendario de la pantalla y no habría forma de
                elegir otro día. */}
            <div ref={setListNode}>
              {items.length === 0 ? (
                calendarOpen && calendar.scope.day ? (
                  <EmptyState
                    message={t("transactions.calendar.empty")}
                    actionLabel={t("transactions.calendar.wholeMonth")}
                    onAction={() => calendar.selectDay(null)}
                  />
                ) : calendarOpen ? (
                  <EmptyState message={t("transactions.calendar.emptyMonth")} />
                ) : (
                  <EmptyState
                    message={t("transactions.list.emptyFiltered")}
                    actionLabel={t("transactions.list.clearFilters")}
                    onAction={() => onFiltersChange(defaultMovementsFilters())}
                  />
                )
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
                  // El resalte de la fila seleccionada vive ACÁ y no adentro
                  // de `SwipeableRow`, que tiene `overflow: hidden` y lo
                  // recortaría. Dibujarlo por detrás además es lo correcto
                  // durante el swipe: `SwipeableRow` es transparente en
                  // reposo y solo se vuelve opaco mientras se arrastra, así
                  // que la fila se despega del resalte con el gesto en vez de
                  // llevárselo puesto.
                  //
                  // `left`/`width`/`paddingInline` compensados: la caja crece
                  // `SELECTION_BLEED` hacia cada lado y el contenido queda en
                  // el mismo x de siempre, alineado con las cabeceras de día
                  // y con el resto de las filas. Sin esto, el anillo pasaba
                  // justo por el borde del ícono y del monto.
                  style={{
                    position: "absolute",
                    top: 0,
                    left: -SELECTION_BLEED,
                    width: `calc(100% + ${SELECTION_BLEED * 2}px)`,
                    paddingInline: SELECTION_BLEED,
                    // `virtualRow.start` está medido desde el origen del
                    // SCROLLER; este `transform` posiciona desde el origen de
                    // la LISTA. Restar `scrollMargin` traduce de uno al otro
                    // (vale 0 cuando la lista arranca en el tope).
                    transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                    ...(item.type === "row" && !selection && item.tx.id === activeTxId
                      ? { background: "var(--selection-surface)", boxShadow: "inset 0 0 0 1px var(--selection-ring)", borderRadius: "var(--radius-card)" }
                      : null),
                  }}
                  // Codificación no visual, para que la fila activa se
                  // anuncie como tal y no dependa solo del color.
                  {...(item.type === "row" && !selection && item.tx.id === activeTxId ? { "aria-current": true as const } : {})}
                >
                  {item.type === "header" ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "16px 0 6px", background: "var(--page)" }}>
                      <span className="t-label" style={{ color: "var(--text-secondary)" }}>
                        {new Date(`${item.date}T00:00:00`).toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "short" })}
                        {/* El conteo solo con el calendario abierto: ahí el
                            día es el alcance elegido y saber cuántos son
                            informa. En la lista normal, repetido en cada
                            cabecera, es ruido. */}
                        {calendarOpen ? (
                          <span style={{ color: "var(--text-muted)" }}> · {t("transactions.list.dayCount", { count: item.count })}</span>
                        ) : null}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: item.total >= 0n ? "var(--money-positive)" : "var(--text-muted)" }}>
                        {formatAmountCompact(money(item.total, item.currency), { showSign: true })}
                      </span>
                    </div>
                  ) : (
                    <SwipeableRow
                      disabled={!!selection}
                      onSwipeLeftCommit={() => handleDelete(item.tx)}
                      onSwipeRightCommit={() => router.push(`/transactions/${item.tx.id}/edit`)}
                      onLongPress={() => setSelection(new Set([item.tx.id]))}
                      confirmLabel={t("transactions.list.confirmDelete")}
                      confirmActionLabel={t("transactions.list.confirmDeleteAction")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {selection ? (
                          <input
                            type="checkbox"
                            checked={selection.has(item.tx.id)}
                            onChange={() => toggleSelected(item.tx.id)}
                            style={{ width: 20, height: 20, flexShrink: 0, accentColor: "var(--primary-fill)" }}
                          />
                        ) : null}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <TransactionRow
                            icon={(categoryById.get(item.tx.categoryId ?? "")?.icon as IconName) ?? (item.tx.kind === "adjustment" ? "circle-half-tilt" : isCardPayment(item.tx) ? "credit-card" : item.tx.kind === "transfer" ? "refresh" : "cart")}
                            merchant={
                              (item.tx.categoryId ? categoryById.get(item.tx.categoryId) : undefined)
                                ? categoryLabel(categoryById.get(item.tx.categoryId!)!)
                                : item.tx.kind === "adjustment"
                                  ? t("transactions.list.reconciliation")
                                  : isCardPayment(item.tx)
                                    ? t("transactions.list.cardPayment")
                                    : item.tx.kind === "transfer"
                                      ? t("transactions.list.transfer")
                                      : t("transactions.list.movement")
                            }
                            meta={buildMeta(
                              item.tx,
                              accountById.get(item.tx.accountId),
                              item.tx.categoryId ? (categoryById.has(item.tx.categoryId) ? categoryLabel(categoryById.get(item.tx.categoryId)!) : undefined) : undefined,
                              isCardPayment(item.tx) ? t("transactions.list.cardPayment") : t("transactions.list.transfer"),
                              tagNamesByTx.get(item.tx.id) ?? [],
                              t("transactions.list.reconciliation"),
                              item.tx.recurringId ? recurringRuleById.get(item.tx.recurringId)?.name : undefined
                            )}
                            value={money(item.tx.kind === "expense" ? -item.tx.amount : item.tx.amount, item.tx.currencyCode)}
                            secondary={
                              item.tx.currencyCode !== baseCurrency && item.tx.amountBase !== null
                                ? formatAmountCompact(money(item.tx.amountBase, baseCurrency), { showSign: false })
                                : undefined
                            }
                            polarity={item.tx.kind === "income" ? "positive" : item.tx.kind === "transfer" || item.tx.kind === "adjustment" ? "neutral" : "negative"}
                            syncIssue={item.tx.syncState === "ok" ? undefined : item.tx.syncState}
                            onClick={() => (selection ? toggleSelected(item.tx.id) : openTransaction(item.tx.id))}
                          />
                        </div>
                      </div>
                    </SwipeableRow>
                  )}
                </div>
              );
            })}
                </div>
              )}
            </div>
          </div>
        </div>

      {selection && selection.size > 0 ? (
        <div style={{ position: "sticky", bottom: 0, display: "flex", gap: 12, padding: "12px 0", background: "var(--page)" }}>
          <Button variant="danger" fullWidth={false} onClick={handleBulkDelete} style={{ flex: 1 }}>
            {t("transactions.list.deleteCount", { count: selection.size })}
          </Button>
          <Button
            variant="secondary"
            fullWidth={false}
            onClick={() => toast(t("transactions.list.categorizeComingSoon"))}
            style={{ flex: 1 }}
          >
            {t("transactions.list.categorize")}
          </Button>
        </div>
      ) : null}

      <MovementsFiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={onFiltersChange}
        accounts={accounts}
        categories={categories}
        tags={tags}
        rules={rules}
        resultCount={filtered.length}
        dateOwnedByCalendar={calendarOpen}
      />
    </div>
  );
}
