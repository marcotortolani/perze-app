"use client";

import dynamic from "next/dynamic";
import { SkeletonRow } from "@/design-system";
import { ModuleGate } from "@/components/module-gate";

const RecurringPageContent = dynamic(() => import("./RecurringPageContent"), {
  loading: () => (
    <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <SkeletonRow />
      <SkeletonRow />
    </div>
  ),
});

/** G2 — recurrentes: la plantilla y si ya se cargó el mes en curso. */
export default function RecurringPage() {
  return (
    <ModuleGate module="recurring">
      <RecurringPageContent />
    </ModuleGate>
  );
}
