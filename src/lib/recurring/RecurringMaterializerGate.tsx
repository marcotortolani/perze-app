"use client";

import dynamic from "next/dynamic";
import { useCurrentHousehold } from "@/hooks/use-current-household";

/**
 * Carga diferida del motor cliente de recurrentes — mismo criterio que
 * `ModuleGate` (CLAUDE.md: "antes de renderizar cualquier cosa de un
 * módulo, chequear `enabled_modules`... el código del módulo no debe
 * llegar al cliente"). A diferencia de `ModuleGate`, esto vive fuera de
 * cualquier página — se monta una sola vez en `Providers` para que el
 * movimiento aparezca en Home y en el saldo sin depender de que el
 * usuario abra `/recurring`.
 */
const RecurringMaterializerLoop = dynamic(() => import("./RecurringMaterializerLoop").then((m) => m.RecurringMaterializerLoop), { ssr: false });

export function RecurringMaterializerGate() {
  const { data: household } = useCurrentHousehold();
  if (!household?.enabledModules.includes("recurring")) return null;
  return <RecurringMaterializerLoop />;
}
