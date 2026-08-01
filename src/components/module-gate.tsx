"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import type { EnabledModule } from "@/lib/db/schema";

export interface ModuleGateProps {
  module: EnabledModule;
  children: ReactNode;
}

/**
 * C16/auditoría: los 6 módulos opcionales (budgets/goals/recurring/debts/
 * investments/family) repetían el mismo par `useEffect(router.replace) +
 * if (...) return null` en cada `page.tsx` — exactamente el `if` en render
 * que la regla del proyecto prohíbe ("antes de renderizar cualquier cosa
 * de un módulo, chequear `enabled_modules`... carga diferida, no un `if`
 * en el render"), y encima no ahorraba nada: el contenido pesado (hooks
 * de datos, analytics) ya se había ejecutado antes de decidir ocultarlo.
 *
 * `<ModuleGate>` mueve la decisión a un componente propio: `children` es
 * un elemento de React ya construido pero SIN MONTAR — React no llama al
 * componente que hay adentro (ni corre sus hooks, ni dispara sus queries)
 * hasta que este componente decide renderizarlo. Envolver el contenido
 * pesado de cada página en su propio componente (no inline) es lo que
 * hace que el gate sea real: si el módulo está apagado, ese componente
 * nunca se monta.
 */
export function ModuleGate({ module, children }: ModuleGateProps) {
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const enabled = household?.enabledModules.includes(module);

  useEffect(() => {
    if (household && !enabled) router.replace("/");
  }, [household, enabled, router]);

  if (!household || !enabled) return null;
  return <>{children}</>;
}
