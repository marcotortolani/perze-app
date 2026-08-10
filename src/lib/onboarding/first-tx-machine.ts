import type { CaptureKind } from "@/stores/capture-draft-store";

/**
 * Máquina de estados del primer contacto con la captura, post A11. La
 * cuenta que sale del onboarding SIEMPRE arranca en cero (el saldo real
 * ya no se pide — A7 se eliminó del flujo), así que el primer movimiento
 * real tiene que ser un ingreso; recién después tiene sentido pedir el
 * gasto que la app usa para juzgarse ("cargar un gasto en menos de 5
 * segundos"). `install` es el tercer y último estado: ahí vive
 * `/onboarding/complete`, hoy reducido a la instalación de la PWA.
 */
export type FirstTxStep = "income" | "expense" | "install";

export type FirstTxEvent = { type: "saved"; kind: CaptureKind } | { type: "skipped" } | { type: "cancelled" };

export interface FirstTxTransition {
  /** Nuevo valor de `draft.firstTxStep` (`null` = fuera del flujo, sin cambios). */
  next: FirstTxStep | null;
  /** Ruta a la que empujar, o `null` para dejar que el caller cierre como de costumbre (home / `router.back()`). */
  route: "/onboarding/first-expense" | "/onboarding/complete" | null;
}

/**
 * `CaptureFlow.onClose` se dispara tanto al guardar como al cancelar — la
 * regla que importa acá es que **cancelar nunca avanza ni empuja**: sin
 * esto, cerrar `/add` con ✕ durante el paso del ingreso empujaría igual
 * a "Cargá tu primer gasto", como si el ingreso ya estuviera cargado.
 *
 * La otra regla no obvia: si mientras se esperaba el ingreso el usuario
 * guarda directamente un gasto (o una transferencia), se salta al paso de
 * instalación en vez de insistir con el ingreso — ya hizo lo que le
 * íbamos a pedir después, no tiene sentido pedírselo dos veces.
 */
export function advanceFirstTx(step: FirstTxStep | null, event: FirstTxEvent): FirstTxTransition {
  if (step === null || step === "install" || event.type === "cancelled") {
    return { next: step, route: null };
  }

  if (step === "income") {
    if (event.type === "saved" && event.kind === "income") {
      return { next: "expense", route: "/onboarding/first-expense" };
    }
    return { next: "install", route: "/onboarding/complete" };
  }

  // step === "expense"
  return { next: "install", route: "/onboarding/complete" };
}
