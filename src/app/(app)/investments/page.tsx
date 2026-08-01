"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/design-system";
import { ModuleGate } from "@/components/module-gate";

const InvestmentsPageContent = dynamic(() => import("./InvestmentsPageContent"), {
  loading: () => <Skeleton height={280} style={{ marginTop: 16 }} />,
});

/**
 * I1/I2 — inversiones: activa el portfolio y muestra la composición por
 * clase de activo (Donut) + valor total.
 */
export default function InvestmentsPage() {
  return (
    <ModuleGate module="investments">
      <InvestmentsPageContent />
    </ModuleGate>
  );
}
