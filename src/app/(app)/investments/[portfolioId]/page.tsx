"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/design-system";
import { ModuleGate } from "@/components/module-gate";

const OverviewContent = dynamic(() => import("./OverviewContent"), {
  loading: () => <Skeleton height={280} style={{ marginTop: 16 }} />,
});

/** I2/I3 — overview de un portfolio puntual. */
export default function PortfolioOverviewPage({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = use(params);
  return (
    <ModuleGate module="investments">
      <OverviewContent portfolioId={portfolioId} />
    </ModuleGate>
  );
}
