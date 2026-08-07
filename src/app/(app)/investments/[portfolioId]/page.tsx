"use client";

import { use, type CSSProperties, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, Skeleton, usePageHeader } from "@/design-system";
import { ModuleGate } from "@/components/module-gate";
import { Modal } from "@/components/modal";
import { DetailPanelTransition } from "@/components/motion";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useInstruments } from "@/hooks/use-investments";

const OverviewContent = dynamic(() => import("./OverviewContent"), {
  loading: () => <Skeleton height={280} style={{ marginTop: 16 }} />,
});
const InstrumentDetailContent = dynamic(() => import("./positions/[instrumentId]/InstrumentDetailContent"), {
  loading: () => <Skeleton height={280} style={{ marginTop: 16 }} />,
});

/**
 * Mismo `SplitGrid` que `accounts/page.tsx`, con una diferencia: ahí la
 * columna izquierda (`AccountsListContent`) ya trae su propio scroller
 * interno (`height:100%` + `overflow-y:auto`), así que el wrapper de acá le
 * alcanza con darle una altura definida. `OverviewContent` no tiene ese
 * scroller propio — es una lista larga de posiciones dentro de un `div`
 * sin `overflow` — así que sin uno acá el contenido desbordaba la celda del
 * grid y hacía scrollear a `<main>` entero (el documento), arrastrando la
 * columna derecha con él en vez de que cada columna scrollee por su cuenta
 * (bug reportado). El wrapper de la izquierda ahora es scroller propio,
 * igual que el de la derecha.
 */
function SplitGrid({
  left,
  right,
  leftOverflowing,
  leftScrollerRef,
  overflowing,
  detailScrollerRef,
}: {
  left: ReactNode;
  right: ReactNode;
  leftOverflowing: boolean;
  leftScrollerRef: (node: HTMLDivElement | null) => void;
  overflowing: boolean;
  detailScrollerRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(340px,504px)", gap: 32, height: "100%", minHeight: 0 }}>
      <div className="scroll-fade-bottom" data-scroll-overflow={leftOverflowing} style={{ "--scroll-fade-inset-right": "12px", minWidth: 0, minHeight: 0 } as CSSProperties}>
        <div
          ref={leftScrollerRef}
          style={{ minWidth: 0, height: "100%", minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", paddingRight: 12 }}
        >
          {left}
        </div>
      </div>
      <div className="scroll-fade-bottom" data-scroll-overflow={overflowing} style={{ "--scroll-fade-inset-right": "12px", minWidth: 0, maxWidth: 504, minHeight: 0 } as CSSProperties}>
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
 * Mismo `DetailHeaderBridge` que `accounts/page.tsx` — montado DESPUÉS de
 * `OverviewContent` en el JSX para ganarle al `usePageHeader` de esa
 * pantalla (título del portfolio + botón de editar) cuando hay una
 * posición seleccionada. En mobile no se monta: `Modal contained` dibuja
 * su propio botón de volver sin título.
 */
function DetailHeaderBridge({ title, backLabel, onClose }: { title: string | undefined; backLabel: string; onClose: () => void }) {
  usePageHeader({ onBack: onClose, backLabel, ...(title ? { title } : {}) });
  return null;
}

/**
 * I2/I3 + I4 — overview de un portfolio (Donut, totales, posiciones) con
 * el detalle de la posición seleccionada.
 *
 * master-detail — la posición se selecciona con un search param
 * (`/investments/[portfolioId]?position=<id>`), NO con una ruta propia —
 * antes era `positions/[instrumentId]/page.tsx`, un salto de ruta completo
 * para lo que visualmente es solo abrir un panel al lado de la lista.
 * Mismo patrón exacto que `/accounts?account=<id>` (ver la nota larga en
 * `accounts/page.tsx`) y `/transactions?tx=<id>`.
 *
 * El portfolio en sí (`portfolioId`) sigue siendo un segmento de ruta, no
 * un param: a diferencia de una cuenta o un movimiento, un portfolio es un
 * destino de navegación completo con sub-rutas propias (alta de
 * instrumento, carga de operación, edición de operación) que ya cuelgan
 * de `[portfolioId]/`. Convertir también la selección de portfolio en
 * `/investments?portfolio=<id>` exigiría un tercer nivel de panel (lista
 * de portfolios → detalle de portfolio → detalle de posición) sin
 * precedente en el resto de la app — `PortfoliosListContent` ya lo decidió
 * así deliberadamente (ver su propio comentario) y esta migración no lo
 * reabre.
 */
export default function PortfolioOverviewPage({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);
  const { ref: leftScrollerRef, overflowing: leftOverflowing } = useScrollOverflow<HTMLDivElement>();
  const { ref: detailScrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();
  const { data: household } = useCurrentHousehold();
  const { data: instruments } = useInstruments(household?.id);

  const positionId = searchParams.get("position");
  const instrument = instruments?.find((i) => i.id === positionId);
  // Ver la nota larga en `OverviewContent`/`usePageHeader`: en split de
  // escritorio con una posición seleccionada, el título lo pone
  // `DetailHeaderBridge` de acá abajo — `OverviewContent` tiene que ceder
  // o su refresco de precios en vivo se lo arrebata en el próximo tick.
  const list = <OverviewContent portfolioId={portfolioId} ownsHeader={!(isSplit && !!positionId)} />;
  // `key`: al cambiar de posición se remonta el detalle, así el estado
  // local (moneda mostrada, sheet de precio manual) no se arrastra de una
  // posición a otra — mismo criterio que `AccountDetailContent`.
  const detail = positionId ? <InstrumentDetailContent key={positionId} portfolioId={portfolioId} instrumentId={positionId} /> : null;

  if (!isSplit) {
    return (
      <ModuleGate module="investments">
        {list}
        {detail ? <Modal contained>{detail}</Modal> : null}
      </ModuleGate>
    );
  }

  return (
    <ModuleGate module="investments">
      <SplitGrid
        left={list}
        right={
          <DetailPanelTransition transitionKey={positionId ?? "__empty"}>
            {detail ?? <EmptyState message={t("instrumentDetailPage.selectPrompt")} />}
          </DetailPanelTransition>
        }
        leftOverflowing={leftOverflowing}
        leftScrollerRef={leftScrollerRef}
        overflowing={overflowing}
        detailScrollerRef={detailScrollerRef}
      />
      {positionId ? <DetailHeaderBridge title={instrument?.symbol} backLabel={t("ds.appHeader.back")} onClose={() => router.back()} /> : null}
    </ModuleGate>
  );
}
