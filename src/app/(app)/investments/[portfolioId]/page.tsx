"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/design-system";
import { ModuleGate } from "@/components/module-gate";
import { Modal } from "@/components/modal";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";

const OverviewContent = dynamic(() => import("./OverviewContent"), {
  loading: () => <Skeleton height={280} style={{ marginTop: 16 }} />,
});
const InstrumentDetailContent = dynamic(() => import("./positions/[instrumentId]/InstrumentDetailContent"), {
  loading: () => <Skeleton height={280} style={{ marginTop: 16 }} />,
});

/**
 * I2/I3 + I4 — overview de un portfolio, rediseñado a partir de las
 * capturas reales de Google Finance que trajo el usuario: página única de
 * ancho completo en desktop (gráfico+highlights arriba, tabla de
 * posiciones abajo con expansión IN PLACE de los lotes de cada
 * instrumento), no el master-detail de panel angosto que usan
 * `accounts`/`transactions`. Ese patrón (`SplitGrid` + `DetailPanelTransition`
 * + `DetailHeaderBridge`) vivía acá hasta esta migración — se sacó
 * enterito para esta pantalla porque un panel de 504px no tiene lugar para
 * un gráfico de tendencia ni para una tabla de 6 columnas.
 *
 * `?position=<id>` sigue existiendo (deep link desde el home, por
 * ejemplo), pero cambia de significado: en vez de abrir un panel al lado,
 * le dice a `OverviewContent` qué fila arrancar expandida en la tabla
 * (desktop) — en mobile sigue abriendo `InstrumentDetailContent` en un
 * `Modal contained` a pantalla completa, sin ningún cambio: ahí no hay
 * ancho de sobra para ganar nada con la tabla nueva, y todo el motor de
 * lotes (Fase 1/2) sigue viviendo en `InstrumentDetailContent` sin tocar.
 */
export default function PortfolioOverviewPage({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = use(params);
  const searchParams = useSearchParams();
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);
  const positionId = searchParams.get("position");

  if (isSplit) {
    return (
      <ModuleGate module="investments">
        <OverviewContent portfolioId={portfolioId} initialExpandedInstrumentId={positionId} />
      </ModuleGate>
    );
  }

  return (
    <ModuleGate module="investments">
      <OverviewContent portfolioId={portfolioId} />
      {positionId ? (
        <Modal contained>
          <InstrumentDetailContent key={positionId} portfolioId={portfolioId} instrumentId={positionId} />
        </Modal>
      ) : null}
    </ModuleGate>
  );
}
