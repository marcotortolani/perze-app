"use client";

import dynamic from "next/dynamic";
import { SkeletonRow } from "@/design-system";
import { ModuleGate } from "@/components/module-gate";

const GoalsPageContent = dynamic(() => import("./GoalsPageContent"), {
  loading: () => (
    <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <SkeletonRow />
      <SkeletonRow />
    </div>
  ),
});

/** F5 — metas: progreso de cada una, medido por el saldo de la cuenta que la respalda. */
export default function GoalsPage() {
  return (
    <ModuleGate module="goals">
      <GoalsPageContent />
    </ModuleGate>
  );
}
