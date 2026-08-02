import { describe, expect, it } from "vitest";
import { fitScale, FIT_FLOOR } from "./Amount";

describe("fitScale — prop `fit` de Amount", () => {
  it("si el texto ya entra, no encoge (escala 1)", () => {
    expect(fitScale(320, 200, 1)).toBe(1);
  });

  it("si no entra, escala en proporción al ancho disponible", () => {
    // 280px disponibles, texto de 400px a escala 1 → cabe al 70%.
    expect(fitScale(280, 400, 1)).toBe(0.7);
  });

  it("nunca escala por debajo de FIT_FLOOR aunque el texto sea mucho más ancho", () => {
    expect(fitScale(50, 1000, 1)).toBe(FIT_FLOOR);
  });

  it("nunca agranda una cifra que ya entra (tope en 1)", () => {
    // contenedor mucho más ancho que el texto → no hay que estirar.
    expect(fitScale(1000, 100, 1)).toBe(1);
  });

  it("devuelve la escala anterior sin cambios si la nueva difiere menos que el epsilon", () => {
    // 280.4/400 = 0.701 contra una escala previa de 0.7 — la diferencia es
    // < 0.01, así que no debe re-disparar un render.
    expect(fitScale(280.4, 400, 0.7)).toBe(0.7);
  });

  it("ignora una medición inválida (contenedor o texto en 0) y conserva la escala anterior", () => {
    expect(fitScale(0, 400, 0.7)).toBe(0.7);
    expect(fitScale(300, 0, 0.7)).toBe(0.7);
  });

  it("converge en pocas iteraciones al aplicarse dos veces seguidas (simula el segundo pase del efecto)", () => {
    // Primera medición: 400px de texto natural en 280px de contenedor → 0.7.
    const first = fitScale(280, 400, 1);
    expect(first).toBe(0.7);
    // Segunda medición: el DOM ya renderiza a `first`, así que `scrollWidth` ≈ 400*0.7;
    // dividir por la escala actual (`first`) recupera el mismo ancho natural (400) —
    // el resultado converge sin seguir oscilando.
    const scrollWidthAtFirst = 400 * first;
    const naturalWidthAgain = scrollWidthAtFirst / first;
    const second = fitScale(280, naturalWidthAgain, first);
    expect(second).toBe(first);
  });
});
