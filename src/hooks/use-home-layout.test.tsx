// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHomeLayoutMirrorStore } from "@/stores/home-layout-mirror-store";
import { useHomeLayout } from "./use-home-layout";

const get = vi.fn();
const save = vi.fn();
const reset = vi.fn();
vi.mock("@/lib/repos/profile-home-layout-repo", () => ({
  profileHomeLayoutRepo: { get: (...args: unknown[]) => get(...args), save: (...args: unknown[]) => save(...args), reset: (...args: unknown[]) => reset(...args) },
}));

let effectiveUserId: string | null | undefined = "user-1";
vi.mock("@/hooks/use-current-user", () => ({ useEffectiveUserId: () => effectiveUserId }));

const messages = { home: { customize: { saveFailed: "No se pudo sincronizar." } } };

function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return renderHook(() => useHomeLayout(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="es" messages={messages}>
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  window.localStorage.clear();
  useHomeLayoutMirrorStore.setState({ doc: null });
  get.mockReset();
  save.mockReset();
  reset.mockReset();
  effectiveUserId = "user-1";
});

afterEach(() => {
  get.mockReset();
  save.mockReset();
  reset.mockReset();
});

describe("useHomeLayout", () => {
  it("sin userId no pega a la red", async () => {
    effectiveUserId = undefined;
    const { result } = render();
    await waitFor(() => expect(result.current.doc).toBeNull());
    expect(get).not.toHaveBeenCalled();
  });

  it("aplica el guardado de forma optimista antes de que la mutación resuelva", async () => {
    get.mockResolvedValue(null);
    let resolveSave: () => void = () => {};
    save.mockImplementation(() => new Promise<void>((resolve) => { resolveSave = resolve; }));

    const { result } = render();
    await waitFor(() => expect(get).toHaveBeenCalled());

    const next = { v: 1 as const, left: ["b", "a"], right: [], hidden: [] };
    act(() => result.current.save(next));

    await waitFor(() => expect(result.current.doc).toEqual(next));
    expect(save).toHaveBeenCalledWith("user-1", next);

    resolveSave();
  });

  it("si el write falla, el espejo local conserva el cambio aplicado (rollback es solo del cache de la query)", async () => {
    get.mockResolvedValue(null);
    save.mockRejectedValue(new Error("network down"));

    const { result } = render();
    await waitFor(() => expect(get).toHaveBeenCalled());

    const next = { v: 1 as const, left: ["b", "a"], right: [], hidden: [] };
    act(() => result.current.save(next));

    await waitFor(() => expect(save).toHaveBeenCalled());
    await waitFor(() => expect(useHomeLayoutMirrorStore.getState().doc).toEqual(next));
  });
});
