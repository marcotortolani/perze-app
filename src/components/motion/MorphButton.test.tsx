// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MorphButton } from "./MorphButton";

// Mismo total que documenta el componente: 240 (morph) + 200 (check) +
// 260 (hold) = 700ms — recorrer eso con fake timers deja la secuencia en
// "idle" de nuevo, lista para un segundo click.
const FULL_SEQUENCE_MS = 700;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function clickSave() {
  fireEvent.click(screen.getByRole("button"));
}

describe("MorphButton", () => {
  it("un segundo guardado, después de que el primero completó la secuencia, vuelve a llamar a onConfirm", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<MorphButton onConfirm={onConfirm}>Guardar</MorphButton>);

    await act(async () => clickSave());
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // Botón deshabilitado mientras corre la secuencia — un segundo click
    // en el medio no dispara un segundo onConfirm.
    fireEvent.click(screen.getByRole("button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FULL_SEQUENCE_MS);
    });

    // De vuelta en "idle": habilitado y respondiendo a un segundo click.
    // Esto es exactamente lo que fallaba antes del fix — el botón quedaba
    // con `disabled={phase !== "idle"}` para siempre tras la primera vez.
    expect(screen.getByRole("button")).not.toBeDisabled();
    await act(async () => clickSave());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("onComplete se llama exactamente una vez por guardado", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn();
    render(
      <MorphButton onConfirm={onConfirm} onComplete={onComplete}>
        Guardar
      </MorphButton>
    );

    await act(async () => clickSave());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FULL_SEQUENCE_MS);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("un onConfirm que rechaza deja el botón habilitado, no lo mata en 'morphing'", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("guardado falló"));
    render(<MorphButton onConfirm={onConfirm}>Guardar</MorphButton>);

    // El componente relanza el error a propósito (no lo decide él, solo
    // se cuida de no quedar inutilizable) — el `onClick` de React no
    // espera esa promesa, así que el rechazo llega como unhandled
    // rejection del proceso, no como una excepción que este test pueda
    // capturar con un try/catch normal. Se intercepta acá para
    // verificar que ocurrió sin dejar que tire la suite.
    const onUnhandledRejection = vi.fn();
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      await act(async () => {
        clickSave();
        await vi.advanceTimersByTimeAsync(0);
      });
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }

    expect(onUnhandledRejection).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button")).not.toBeDisabled();

    // Puede reintentar de inmediato.
    onConfirm.mockResolvedValueOnce(undefined);
    await act(async () => clickSave());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("desmontar durante 'morphing' no tira al completar los timers pendientes", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(<MorphButton onConfirm={onConfirm}>Guardar</MorphButton>);

    await act(async () => clickSave());
    unmount();

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(FULL_SEQUENCE_MS);
      });
    }).not.toThrow();
  });
});
