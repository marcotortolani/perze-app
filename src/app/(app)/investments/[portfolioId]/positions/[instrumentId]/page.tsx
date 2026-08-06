"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/design-system";
import { ModuleGate } from "@/components/module-gate";

const InstrumentDetailContent = dynamic(() => import("./InstrumentDetailContent"), {
  loading: () => <Skeleton height={280} style={{ marginTop: 16 }} />,
});

/** I4 — detalle de instrumento: tu posición, P&L no realizado, y el historial de operaciones. */
export default function InstrumentDetailPage({ params }: { params: Promise<{ portfolioId: string; instrumentId: string }> }) {
  const { portfolioId, instrumentId } = use(params);
  return (
    <ModuleGate module="investments">
      <InstrumentDetailContent portfolioId={portfolioId} instrumentId={instrumentId} />
    </ModuleGate>
  );
}
