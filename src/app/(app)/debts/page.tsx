"use client";

import dynamic from "next/dynamic";
import { SkeletonRow } from "@/design-system";
import { ModuleGate } from "@/components/module-gate";

const DebtsPageContent = dynamic(() => import("./DebtsPageContent"), {
  loading: () => (
    <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <SkeletonRow />
      <SkeletonRow />
    </div>
  ),
});

/**
 * G4 — deudas: cuentas de tipo préstamo/por cobrar/tarjeta con saldo
 * pendiente, más los planes de cuotas y préstamos propios de `debts`.
 */
export default function DebtsPage() {
  return (
    <ModuleGate module="debts">
      <DebtsPageContent />
    </ModuleGate>
  );
}
