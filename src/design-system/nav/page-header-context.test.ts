import { describe, expect, it } from "vitest";
import { samePageHeaderConfig, type PageHeaderConfig } from "./page-header-context";

/**
 * `usePageHeader` registra su config en CADA render, a propósito (ver la nota
 * larga en el archivo). Eso hacía que el proveedor cambiara de estado en cada
 * render de cualquier pantalla, y que no terminara en "Maximum update depth
 * exceeded" dependía de un bail-out de React. `samePageHeaderConfig` es lo que
 * corta esa cadena, y solo funciona si `onBack` es estable por consumidor —
 * por eso el hook pasa un wrapper con identidad fija en vez de la arrow que
 * recibe.
 */
describe("samePageHeaderConfig", () => {
  const onBack = () => {};

  it("dos configs equivalentes con el MISMO onBack son iguales", () => {
    const a: PageHeaderConfig = { title: "Cuentas", backLabel: "Volver", onBack };
    const b: PageHeaderConfig = { title: "Cuentas", backLabel: "Volver", onBack };
    expect(samePageHeaderConfig(a, b)).toBe(true);
  });

  it("distinto título no es igual", () => {
    expect(samePageHeaderConfig({ title: "Cuentas" }, { title: "Movimientos" })).toBe(false);
  });

  it("distinto backLabel no es igual", () => {
    expect(samePageHeaderConfig({ backLabel: "Volver" }, { backLabel: "Atrás" })).toBe(false);
  });

  it("aparecer o desaparecer onBack no es igual — es lo que distingue lista de detalle", () => {
    expect(samePageHeaderConfig({ title: "Cuentas" }, { title: "Cuentas", onBack })).toBe(false);
    expect(samePageHeaderConfig({ title: "Cuentas", onBack }, { title: "Cuentas" })).toBe(false);
  });

  it("dos onBack DISTINTOS no son iguales — dos consumidores no se confunden entre sí", () => {
    expect(samePageHeaderConfig({ onBack }, { onBack: () => {} })).toBe(false);
  });

  it("null contra config no es igual, y null contra null sí", () => {
    expect(samePageHeaderConfig(null, { title: "Cuentas" })).toBe(false);
    expect(samePageHeaderConfig({ title: "Cuentas" }, null)).toBe(false);
    expect(samePageHeaderConfig(null, null)).toBe(true);
  });

  it("una arrow nueva en cada render daría SIEMPRE distinto — el motivo de que el hook estabilice onBack", () => {
    // Esto documenta por qué la comparación sola no alcanzaba: es el caso
    // que se daba antes de que `usePageHeader` pasara un wrapper estable.
    const render = (): PageHeaderConfig => ({ title: "Cuentas", onBack: () => {} });
    expect(samePageHeaderConfig(render(), render())).toBe(false);
  });
});
