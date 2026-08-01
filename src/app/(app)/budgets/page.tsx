"use client";

import dynamic from "next/dynamic";
import { SkeletonRow } from "@/design-system";
import { ModuleGate } from "@/components/module-gate";

// C15/C16 — el contenido real (hooks de datos + analytics de presupuesto)
// se carga diferido: si el módulo está apagado, ni siquiera se descarga.
const BudgetsPageContent = dynamic(() => import("./BudgetsPageContent"), {
  loading: () => (
    <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <SkeletonRow />
      <SkeletonRow />
    </div>
  ),
});

/** F1 — presupuestos: progreso de cada uno en el período en curso. */
export default function BudgetsPage() {
  return (
    <ModuleGate module="budgets">
      <BudgetsPageContent />
    </ModuleGate>
  );
}
