import { describe, expect, it } from "vitest";
import { fitScale, isTruncated, FIT_FLOOR } from "./Amount";

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

describe("isTruncated — cuándo ni el piso de fitScale alcanza", () => {
  it("si el texto entra sin escalar, nunca está truncado", () => {
    expect(isTruncated(320, 200)).toBe(false);
  });

  it("si escala por encima del piso, entra y no está truncado", () => {
    // 280/400 = 0.7, por encima del FIT_FLOOR (0.55) default.
    expect(isTruncated(280, 400)).toBe(false);
  });

  it("si ni al piso entra, está truncado — el caso que antes se recortaba en silencio", () => {
    // Al FIT_FLOOR (0.55), el texto de 1000px mide 550px — sigue sin
    // entrar en un contenedor de 50px.
    expect(isTruncated(50, 1000)).toBe(true);
  });

  it("justo en el límite del piso no cuenta como truncado (< estricto, no <=)", () => {
    // 0.5 en vez de 0.55: exacto en binario, evita que un error de
    // redondeo de punto flotante en 400*0.55 mueva la frontera del test.
    // containerWidth == naturalWidth * floor exactamente: fitScale lo deja
    // pasar (clamped = floor = containerWidth/naturalWidth), así que
    // truncated tiene que coincidir con esa misma frontera.
    expect(isTruncated(200, 400, 0.5)).toBe(false); // 400*0.5 = 200
    expect(isTruncated(199, 400, 0.5)).toBe(true);
  });

  it("respeta un fitFloor custom, no solo el default", () => {
    // Con floor 0.4 en vez del default 0.55, el piso de "entra sin
    // truncar" baja de 220 a 160 (400*0.4) — el mismo caso de arriba
    // (280/400) sigue sin estar truncado, pero acá además un contenedor
    // más angosto (200) que SÍ hubiera truncado con el floor default
    // ahora entra justo.
    expect(isTruncated(200, 400, 0.4)).toBe(false); // 400*0.4 = 160 < 200
    expect(isTruncated(100, 400, 0.4)).toBe(true); // 400*0.4 = 160 > 100
  });

  it("ignora una medición inválida (contenedor o texto en 0)", () => {
    expect(isTruncated(0, 400)).toBe(false);
    expect(isTruncated(300, 0)).toBe(false);
  });
});
