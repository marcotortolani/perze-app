"use client";

import { type CSSProperties, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePageHeader } from "@/design-system";
import { Modal } from "@/components/modal";
import { DetailPanelTransition, PageEnter } from "@/components/motion";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useTransactions } from "@/hooks/use-transactions";
import { MovementsListContent } from "./TransactionsListContent";
import { TransactionDetailContent } from "./TransactionDetailContent";
import { TransactionsDetailEmpty } from "./TransactionsDetailEmpty";
import { TransactionsMonthCalendar } from "./TransactionsMonthCalendar";
import { useCalendarView } from "./use-calendar-view";

/**
 * Las dos columnas del split, en una constante nombrada porque el ancho es
 * cosa de mirar y ajustar, no de deducir.
 *
 * Da ~54/46 a 1280 y ~60/40 a 1440, y la derecha deja de crecer a partir de
 * ahí. Antes era `minmax(340px,420px)`, un ancho pensado solo para el detalle;
 * ahora esa columna también aloja el calendario, que necesita más aire.
 *
 * **La geometría NO depende de quién ocupa la columna.** Hacer que el grid
 * cambie según haya calendario o detalle produce un salto de ancho justo al
 * abrir un movimiento desde el calendario — el jank que `DetailPanelTransition`
 * existe para evitar. Por eso el techo de lectura del detalle se declara
 * adentro del detalle, no acá.
 */
const SPLIT_COLUMNS = "minmax(0,1fr) minmax(360px,560px)";

function SplitGrid({ left, right, overflowing, detailScrollerRef }: { left: ReactNode; right: ReactNode; overflowing: boolean; detailScrollerRef: (node: HTMLDivElement | null) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: SPLIT_COLUMNS, gap: 32, height: "100%", minHeight: 0 }}>
      <div style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>{left}</div>
      {/* `paddingRight`: sin esto la barra de scroll de esta columna queda
          pegada contra el borde del contenido (a diferencia de la lista de
          la izquierda, que hereda el `padding-inline` de `<main>` — esta
          columna no tiene ningún padding propio del lado derecho).
          `minWidth: 0` + `overflowX: hidden`: mismo fix que
          `accounts/page.tsx` — sin `minWidth: 0` el ítem de grid vale
          `min-width: auto` y el contenido (una cifra larga, un chart)
          podía forzarlo más ancho que `minmax(340px,420px)`, y
          `overflow-y: auto` sin `overflow-x` explícito activa
          `overflow-x: auto` implícito por la propia regla de `overflow`. */}
      {/* `scroll-fade-bottom` en un wrapper propio — mismo patrón que
          `accounts/page.tsx`. `paddingBottom: 32` adentro del scroller:
          aire real al final para el fade. */}
      <div className="scroll-fade-bottom" data-scroll-overflow={overflowing} style={{ "--scroll-fade-inset-right": "12px", minWidth: 0, minHeight: 0 } as CSSProperties}>
        <div
          ref={detailScrollerRef}
          style={{
            minWidth: 0,
            height: "100%",
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            borderLeft: "1px solid var(--border)",
            paddingLeft: 32,
            paddingRight: 12,
            paddingBottom: 32,
          }}
        >
          {right}
        </div>
      </div>
    </div>
  );
}

/**
 * Registra el header del shell para el detalle abierto en desktop (el botón
 * de volver, que deselecciona el movimiento).
 *
 * Vive en un componente propio, montado solo cuando corresponde, porque
 * `usePageHeader` no se puede llamar condicionalmente y porque
 * `MovementsListContent` también lo llama: los dos escriben el mismo config en
 * cada render, sin cleanup (ver `design-system/nav/page-header-context.tsx`),
 * así que gana el último efecto en correr. Montado DESPUÉS de la lista en el
 * JSX, ese último es este — que es lo que se quiere cuando hay un movimiento
 * seleccionado. En mobile no se monta: ahí el detalle va adentro de `Modal`,
 * que tapa el header del shell y dibuja su propio botón de volver.
 */
function DetailHeaderBridge({ backLabel, onClose }: { backLabel: string; onClose: () => void }) {
  usePageHeader({ onBack: onClose, backLabel });
  return null;
}

/**
 * D1/D2 + D3 — lista de movimientos y detalle del movimiento seleccionado.
 *
 * El detalle se selecciona con un search param (`/transactions?tx=<id>`), NO
 * con una ruta propia. Antes era `/transactions/[id]` interceptado por un slot
 * paralelo `@detail`, con los mismos dos problemas que ya se corrigieron en
 * `/accounts` (ver la nota larga en `accounts/page.tsx`):
 *
 * 1. Next.js 16 tiene un bug abierto (vercel/next.js#91265) por el que las
 *    rutas interceptoras acumulan un marcador `(.)` en cada actualización de
 *    HMR, hasta que el server tira `Invalid interception route` y fuerza una
 *    recarga completa de página.
 * 2. Y, con o sin ese bug, elegir un movimiento era una navegación de ruta
 *    —con el desmontaje de layout que eso implica— aunque visualmente solo
 *    cambiara una columna. Pasar de un movimiento a otro parpadeaba.
 *
 * Con un param, elegir un movimiento es un cambio de estado en la misma
 * pantalla: la lista nunca se desmonta (conserva su scroll y sus filtros) y no
 * hay ninguna ruta interceptora que pueda acumular nada.
 *
 * Editar sigue siendo una ruta de verdad (`/transactions/[id]/edit`), igual
 * que en cuentas: es una pantalla completa, no una selección.
 *
 * Se abre con `push` (no `replace`) para que el botón atrás del navegador —y
 * el de Android en la PWA— cierre el detalle. Cerrar es siempre
 * `router.back()`, simétrico.
 */
export default function MovementsPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);
  const { ref: detailScrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();
  const calendarView = useCalendarView();
  const { data: household } = useCurrentHousehold();
  const { data: transactions } = useTransactions(household?.id);

  const txId = searchParams.get("tx");

  /**
   * El heatmap se calcula sobre TODOS los movimientos del household, no sobre
   * la lista filtrada. Dos razones: el gasto por día es una referencia fija
   * —si se filtrara por el rango activo, elegir un día apagaría el resto del
   * mes y la visualización se borraría a sí misma— y así el calendario no
   * depende del estado de filtros, que vive adentro de la lista.
   */
  const calendar = calendarView.open ? (
    <TransactionsMonthCalendar
      month={calendarView.scope.month}
      selectedDay={calendarView.scope.day}
      transactions={transactions ?? []}
      baseCurrency={household?.baseCurrency ?? "UYU"}
      onMonthChange={calendarView.changeMonth}
      onSelectDay={calendarView.selectDay}
    />
  ) : null;

  // En escritorio el calendario vive en la segunda columna, así que no baja
  // como slot; en mobile y tablet va adentro del scroller de la lista, arriba
  // de las filas.
  const list = <MovementsListContent calendarOpen={calendarView.open} calendarSlot={isSplit ? undefined : calendar} />;
  // `key`: al cambiar de movimiento se remonta el detalle, así el estado local
  // (el sheet de resolver cotización) no se arrastra de uno al otro.
  const detail = txId ? <TransactionDetailContent key={txId} id={txId} /> : null;

  if (!isSplit) {
    return (
      <>
        {list}
        {detail ? <Modal contained>{detail}</Modal> : null}
      </>
    );
  }

  /**
   * La segunda columna la pelean el detalle y el calendario, y gana el
   * detalle: se llegó a ese movimiento DESDE el día del calendario, el alcance
   * del día sigue aplicado a la lista de la izquierda y esa lista sigue
   * visible con la fila resaltada. Cerrar el detalle es `router.back()`, que
   * restaura `view=calendar` sin ningún código extra porque el param nunca se
   * perdió.
   *
   * El swap lo anima `DetailPanelTransition` con solo ampliar su
   * `transitionKey` a tres valores — cero maquinaria nueva.
   */
  return (
    <>
      <SplitGrid
        left={list}
        right={
          /**
           * `transitionKey` cambia solo cuando cambia el DETALLE, no cuando se
           * prende el calendario. No es una simplificación: meter los tres
           * estados en el mismo `AnimatePresence mode="wait"` lo deja
           * trabado — la salida del estado vacío no resuelve nunca y el hijo
           * nuevo no llega a montarse, así que el calendario no aparecía.
           * `mode="wait"` está para que los dos paneles no se superpongan en
           * el mismo track del grid, y esa razón sigue valiendo para el
           * detalle; el calendario, que ocupa el mismo lugar que el estado
           * vacío, entra con su propia animación de montaje (`PageEnter`).
           */
          <DetailPanelTransition transitionKey={txId ?? "__placeholder"}>
            {detail ?? (calendar ? <PageEnter style={{}}>{calendar}</PageEnter> : <TransactionsDetailEmpty />)}
          </DetailPanelTransition>
        }
        overflowing={overflowing}
        detailScrollerRef={detailScrollerRef}
      />
      {txId ? <DetailHeaderBridge backLabel={t("transactions.detail.back")} onClose={() => router.back()} /> : null}
    </>
  );
}
