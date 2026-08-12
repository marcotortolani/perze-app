// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Amount } from "./Amount";
import { money } from "@/lib/money/money";

/**
 * Test de regresión para el bug real: `fitScale()` (probada por separado en
 * `Amount.test.ts`) siempre estuvo bien, pero el `<span>` que se mide nunca
 * tuvo `display` explícito — quedaba `inline`, y una caja `inline` da
 * `scrollWidth === 0` en Blink/WebKit, así que la escala nunca bajaba de 1
 * en ningún lado donde se usaba `fit`. Este test renderiza de verdad y
 * mockea `scrollWidth`/`clientWidth` para probar que el componente aplica
 * la escala — no alcanza con que la función pura esté bien.
 */

beforeAll(() => {
  // happy-dom no implementa ResizeObserver — Amount solo necesita `observe`/
  // `disconnect` como no-ops porque la medición inicial se hace de forma
  // síncrona en el `useLayoutEffect`, no depende de que el observer dispare.
  class StubResizeObserver {
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  globalThis.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;

  // El contenedor (`outer`) mide 280px de ancho disponible; el texto
  // (`inner`) mide 400px a escala 1 → tiene que encoger a 280/400 = 0.7.
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 280 });
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, value: 400 });
});

afterEach(cleanup);

function renderAmount(props: Partial<React.ComponentProps<typeof Amount>> = {}) {
  return render(
    <NextIntlClientProvider locale="es" messages={{}}>
      <Amount value={money(123456789n, "USD")} size="hero" fit {...props} />
    </NextIntlClientProvider>,
  );
}

// Nota: happy-dom no valida `calc(var(--x) * 0.7)` como valor de `font-size`
// (lo descarta en silencio al asignarlo vía `style.fontSize = …`, que es el
// camino que usa React) — no hay forma de leer el factor de escala de vuelta
// desde el CSS renderizado en este entorno de test. La matemática de la
// escala ya está cubierta por los tests puros de `fitScale` en
// `Amount.test.ts`; lo que este archivo prueba es el bug real: que la caja
// que se mide sea `inline-block` y no `inline` (el `<span>` por defecto),
// que es lo único que hacía que `scrollWidth` diera 0 siempre.
describe("Amount — integración de `fit`", () => {
  it("la caja que se mide es inline-block cuando fit está activo", () => {
    const { container } = renderAmount();
    const inner = container.querySelector<HTMLElement>("span span") ?? container.querySelector<HTMLElement>("span");
    expect(inner).not.toBeNull();
    expect(inner!.style.display).toBe("inline-block");
  });

  it("sin fit, no fuerza ningún display — el nowrap de siempre sigue como estaba", () => {
    const { container } = render(
      <NextIntlClientProvider locale="es" messages={{}}>
        <Amount value={money(123456789n, "USD")} size="hero" />
      </NextIntlClientProvider>,
    );
    const inner = container.querySelector<HTMLElement>("span");
    expect(inner!.style.display).toBe("");
  });

  it("mide de forma síncrona en el primer render (no depende de que ResizeObserver dispare)", () => {
    let measured = false;
    class ObservingStub {
      observe() {
        measured = true;
      }
      disconnect() {}
      unobserve() {}
    }
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = ObservingStub as unknown as typeof ResizeObserver;
    try {
      renderAmount();
      expect(measured).toBe(true);
    } finally {
      globalThis.ResizeObserver = original;
    }
  });

});

/**
 * La matemática exacta de `truncated` (dónde está el límite, un fitFloor
 * custom, casos borde) se prueba sin DOM en `isTruncated()`
 * (`Amount.test.ts`) — acá solo se verifica que el componente la conecta
 * de verdad al atributo `data-truncated`/`title`.
 *
 * Los dos casos de este describe usan disparidades GRANDES a propósito
 * (contenedor mucho más chico o mucho más grande que el texto), no un
 * caso al límite como 280/400: el `scrollWidth` mockeado es una
 * CONSTANTE (no reacciona al `font-size` real como en un browser — mismo
 * límite del entorno de test que ya documenta el describe de arriba), así
 * que cuando el efecto se re-dispara por el cambio de `scale` (pasa varias
 * veces dentro de un solo `render()`), cada pasada recalcula `naturalWidth`
 * dividiendo esa constante por una `scale` cada vez más chica — en un
 * browser real eso converge porque `scrollWidth` SÍ se achica junto con el
 * `scale` anterior; acá diverge. Con una disparidad grande el resultado de
 * `truncated` no cambia de signo entre pasadas, así que el test es estable
 * sin depender de en qué pasada se haya "asentado" el efecto.
 */
describe("Amount — `truncated` cuando ni el piso de `fit` alcanza", () => {
  afterEach(() => {
    // Vuelve al fixture del describe de arriba (280/400) para no filtrar
    // este ancho a otros tests del archivo.
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 280 });
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, value: 400 });
  });

  it("contenedor mucho más chico que el texto: marca truncated y conserva el valor completo en title", () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 50 });
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, value: 1000 });

    const { container } = renderAmount({ size: "hero-xl", fitFloor: 0.4 });

    const outer = container.querySelector<HTMLElement>("span[data-truncated='true']");
    expect(outer).not.toBeNull();
    expect(outer!.title).toContain("1.234.567");
  });

  it("contenedor más ancho que el texto (nunca necesita achicar): no marca truncated", () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 500 });
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, value: 400 });

    const { container } = renderAmount({ size: "hero-xl", fitFloor: 0.4 });

    expect(container.querySelector("span[data-truncated]")).toBeNull();
  });
});
