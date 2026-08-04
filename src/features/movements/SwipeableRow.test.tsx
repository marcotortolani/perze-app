// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// `useDrag` (@use-gesture/react) resuelve el gesto contra eventos de
// puntero reales del navegador — bajo happy-dom el motor interno nunca
// llega a emitir (requiere `PointerEvent`/`setPointerCapture` reales que
// happy-dom no reproduce fielmente). Estos tests no verifican la
// mecánica del gesto (eso es responsabilidad de la librería); verifican
// la lógica PROPIA de `SwipeableRow` — qué hace con el `state` que
// `useDrag` le entrega. Por eso se mockea `useDrag` y se invoca el
// callback capturado directamente con estados sintéticos.
type DragState = { down: boolean; movement: [number, number]; last: boolean; cancel: () => void };
let dragCallback: (state: DragState) => void;

vi.mock("@use-gesture/react", () => ({
  useDrag: (cb: (state: DragState) => void) => {
    dragCallback = cb;
    return () => ({});
  },
}));

const { SwipeableRow } = await import("./SwipeableRow");

const cancel = vi.fn();

/** Simula un ciclo de swipe completo: un `down`, un `move`, y el `last` con el `mx` final. */
function drag(mx: number) {
  act(() => {
    dragCallback({ down: true, movement: [0, 0], last: false, cancel });
    dragCallback({ down: true, movement: [mx, 0], last: false, cancel });
    dragCallback({ down: false, movement: [mx, 0], last: true, cancel });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderRow(overrides: Record<string, unknown> = {}) {
  const onSwipeLeftCommit = vi.fn();
  const onSwipeRightCommit = vi.fn();
  render(
    <SwipeableRow
      onSwipeLeftCommit={onSwipeLeftCommit}
      onSwipeRightCommit={onSwipeRightCommit}
      confirmLabel="¿Borrar movimiento?"
      confirmActionLabel="Borrar"
      {...overrides}
    >
      <div>Fila</div>
    </SwipeableRow>
  );
  return { onSwipeLeftCommit, onSwipeRightCommit };
}

describe("SwipeableRow", () => {
  it("un swipe izquierdo pasado el umbral NO borra directo: entra en confirmación", () => {
    const { onSwipeLeftCommit } = renderRow();
    drag(-200);
    expect(onSwipeLeftCommit).not.toHaveBeenCalled();
    expect(screen.getByText("¿Borrar movimiento?")).toBeInTheDocument();
  });

  it("confirmar llama a onSwipeLeftCommit una sola vez", () => {
    const { onSwipeLeftCommit } = renderRow();
    drag(-200);
    fireEvent.click(screen.getByText("Borrar"));
    expect(onSwipeLeftCommit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("¿Borrar movimiento?")).not.toBeInTheDocument();
  });

  it("la confirmación se cancela sola a los 4s", () => {
    renderRow();
    drag(-200);
    expect(screen.getByText("¿Borrar movimiento?")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText("¿Borrar movimiento?")).not.toBeInTheDocument();
  });

  it("un pointerdown afuera de la fila cancela la confirmación", () => {
    const { onSwipeLeftCommit } = renderRow();
    drag(-200);
    expect(screen.getByText("¿Borrar movimiento?")).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText("¿Borrar movimiento?")).not.toBeInTheDocument();
    expect(onSwipeLeftCommit).not.toHaveBeenCalled();
  });

  it("un scroll cancela la confirmación", () => {
    renderRow();
    drag(-200);
    expect(screen.getByText("¿Borrar movimiento?")).toBeInTheDocument();
    fireEvent.scroll(window);
    expect(screen.queryByText("¿Borrar movimiento?")).not.toBeInTheDocument();
  });

  it("un swipe a la derecha estando en confirmación cancela y NO navega a editar", () => {
    const { onSwipeRightCommit } = renderRow();
    drag(-200);
    expect(screen.getByText("¿Borrar movimiento?")).toBeInTheDocument();

    // Mientras `confirming`, el componente ignora el commit del drag y
    // solo cancela — no delega a `onSwipeRightCommit`.
    drag(40);

    expect(screen.queryByText("¿Borrar movimiento?")).not.toBeInTheDocument();
    expect(onSwipeRightCommit).not.toHaveBeenCalled();
  });

  it("un swipe derecho pasado el umbral (sin confirmación previa) llama a onSwipeRightCommit", () => {
    const { onSwipeRightCommit } = renderRow();
    drag(200);
    expect(onSwipeRightCommit).toHaveBeenCalledTimes(1);
  });

  it("disabled ignora el gesto por completo", () => {
    const { onSwipeLeftCommit } = renderRow({ disabled: true });
    drag(-200);
    expect(onSwipeLeftCommit).not.toHaveBeenCalled();
    expect(screen.queryByText("¿Borrar movimiento?")).not.toBeInTheDocument();
  });
});
