// @vitest-environment happy-dom
import type { ReactNode } from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaptureDraftProvider, useCaptureDraftStore, useCaptureDraftStoreApi, type CaptureDraft } from "./capture-draft-store";

function wrapperWith(initial?: Partial<CaptureDraft>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <CaptureDraftProvider initial={initial}>{children}</CaptureDraftProvider>;
  };
}

function useTestStore() {
  return {
    draft: useCaptureDraftStore((s) => s.draft),
    setField: useCaptureDraftStore((s) => s.setField),
    resetForBurst: useCaptureDraftStore((s) => s.resetForBurst),
    reset: useCaptureDraftStore((s) => s.reset),
    api: useCaptureDraftStoreApi(),
  };
}

describe("useCaptureDraftStore fuera de un CaptureDraftProvider", () => {
  it("tira un error explícito en vez de fallar silenciosamente", () => {
    // Sin wrapper: no hay Provider en el árbol.
    expect(() => renderHook(() => useCaptureDraftStore((s) => s.draft))).toThrow(/CaptureDraftProvider/);
  });
});

describe("CaptureDraftProvider — store por instancia, no singleton", () => {
  it("dos providers montados a la vez tienen estados completamente independientes", () => {
    const a = renderHook(() => useTestStore(), { wrapper: wrapperWith() });
    const b = renderHook(() => useTestStore(), { wrapper: wrapperWith() });

    act(() => a.result.current.setField("note", "nota de A"));

    expect(a.result.current.draft.note).toBe("nota de A");
    // B nunca vio el setField de A — es justamente lo que el singleton
    // viejo no garantizaba (edición y alta compartían un solo store).
    expect(b.result.current.draft.note).toBe("");
  });

  it("aplica `initial` una sola vez, al crear el store — no es reactivo a cambios posteriores de la prop", () => {
    const { result, rerender } = renderHook(() => useTestStore(), {
      wrapper: wrapperWith({ kind: "income", note: "prefill" }),
    });

    expect(result.current.draft.kind).toBe("income");
    expect(result.current.draft.note).toBe("prefill");

    // Cambiar lo que pasaría por `initial` en un remount no debería
    // pisar el store ya creado — mismo store, mismo `useRef`.
    rerender();
    expect(result.current.draft.note).toBe("prefill");
  });

  it("reset() vuelve al borrador vacío, sin arrastrar nada del prefill inicial", () => {
    const { result } = renderHook(() => useTestStore(), {
      wrapper: wrapperWith({ kind: "income", note: "prefill" }),
    });

    act(() => result.current.setField("amountExpression", "1000"));
    act(() => result.current.reset());

    expect(result.current.draft).toMatchObject({ kind: "expense", note: "", amountExpression: "" });
  });

  it("resetForBurst preserva cuenta, moneda y fecha, e incrementa burstCount", () => {
    const { result } = renderHook(() => useTestStore(), { wrapper: wrapperWith() });

    act(() => {
      result.current.setField("accountId", "acc-1");
      result.current.setField("currency", "ARS");
      result.current.setField("occurredAt", "2026-08-11T10:00:00.000Z");
      result.current.setField("categoryId", "cat-1");
      result.current.setField("amountExpression", "5000");
    });

    act(() => result.current.resetForBurst());

    expect(result.current.draft).toMatchObject({
      accountId: "acc-1",
      currency: "ARS",
      occurredAt: "2026-08-11T10:00:00.000Z",
      categoryId: null,
      amountExpression: "",
      burstMode: true,
      burstCount: 1,
    });
  });

  it("useCaptureDraftStoreApi().getState() lee el estado más reciente sin suscribirse (sin re-render)", () => {
    const { result } = renderHook(() => useTestStore(), { wrapper: wrapperWith() });

    act(() => result.current.setField("note", "recién escrito"));

    expect(result.current.api.getState().draft.note).toBe("recién escrito");
  });
});
