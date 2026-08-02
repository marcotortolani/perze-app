export * from "./core";
export * from "./money";
export * from "./finance";
export * from "./nav";
export * from "./feedback";
// Fase 5 del plan de fluidez de navegación — `./charts` (13 componentes
// SVG) y `./systems` NO se re-exportan desde acá a propósito: cada
// pantalla que solo necesita `Card`/`Skeleton`/etc. arrastraba el grafo
// completo de gráficos por este barril. Importar directo desde
// `@/design-system/charts` o `@/design-system/systems` (varias pantallas
// ya lo hacían así, p. ej. `pin-gate.tsx` con `LockScreen`).
