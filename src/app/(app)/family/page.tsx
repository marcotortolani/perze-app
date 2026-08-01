"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/design-system";
import { ModuleGate } from "@/components/module-gate";

const FamilyPageContent = dynamic(() => import("./FamilyPageContent"), {
  loading: () => <Skeleton height={200} style={{ marginTop: 16 }} />,
});

/** J1/J2 — grupo familiar: quién está, quién falta aceptar, entrada a comparar/invitar. */
export default function FamilyPage() {
  return (
    <ModuleGate module="family">
      <FamilyPageContent />
    </ModuleGate>
  );
}
