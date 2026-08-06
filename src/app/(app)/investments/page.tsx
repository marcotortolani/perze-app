"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/design-system";
import { ModuleGate } from "@/components/module-gate";

const PortfoliosListContent = dynamic(() => import("./PortfoliosListContent"), {
  loading: () => <Skeleton height={280} style={{ marginTop: 16 }} />,
});

/** Raíz del bloque I — lista de portfolios, mismo rol que `/accounts` para cuentas. */
export default function InvestmentsPage() {
  return (
    <ModuleGate module="investments">
      <PortfoliosListContent />
    </ModuleGate>
  );
}
