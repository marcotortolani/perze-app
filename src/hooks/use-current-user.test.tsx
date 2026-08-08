// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCurrentUserId } from "./use-current-user";

vi.mock("@/env", () => ({ env: { NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijkl.supabase.co" } }));

const getSession = vi.fn();
const getUser = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession, getUser, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  }),
}));

const KEY = "sb-abcdefghijkl-auth-token";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

function setSessionCookie(userId: string): void {
  const payload = Buffer.from(JSON.stringify({ user: { id: userId } }), "utf-8").toString("base64url");
  document.cookie = `${KEY}=${encodeURIComponent(`base64-${payload}`)}`;
}

function clearCookies(): void {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

/**
 * `getUser()` es un round-trip contra el Auth server: siempre resuelve
 * DESPUÉS de que la query se asentó en el cache. Un `mockResolvedValue`
 * resuelve en el microtask siguiente y le gana a esa escritura, así que el
 * `setQueryData()` de la confirmación quedaba pisado por el valor optimista
 * y los tests medían la carrera del mock, no el comportamiento real.
 */
function respondsLater<T>(value: T): () => Promise<T> {
  return () => new Promise<T>((resolve) => setTimeout(() => resolve(value), 0));
}

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, "onLine", { value: online, configurable: true });
}

function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useCurrentUserId(), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

beforeEach(() => {
  clearCookies();
  setOnline(true);
  getSession.mockReset();
  getUser.mockReset();
});

afterEach(() => {
  setOnline(true);
});

describe("useCurrentUserId", () => {
  it("resuelve el uid de la sesión y lo confirma con getUser()", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: USER_ID } } } });
    getUser.mockImplementation(respondsLater({ data: { user: { id: USER_ID } }, error: null }));

    const { result } = render();
    await waitFor(() => expect(result.current).toBe(USER_ID));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBe(USER_ID);
  });

  it("no pisa el uid con null cuando getUser() falla por red", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: USER_ID } } } });
    getUser.mockImplementation(respondsLater({ data: { user: null }, error: new AuthRetryableFetchError("Failed to fetch", 0) }));

    const { result } = render();
    await waitFor(() => expect(result.current).toBe(USER_ID));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBe(USER_ID);
  });

  it("defecto A — sin sesión pero con cookie y sin red, devuelve el uid persistido", async () => {
    // El caso reportado: PWA cerrada del todo, sin internet, access token
    // vencido. `getSession()` intenta refrescar, falla y devuelve null; sin
    // este fallback la app redirige a `/onboarding` y no se puede cargar
    // un gasto.
    setSessionCookie(USER_ID);
    setOnline(false);
    getSession.mockResolvedValue({ data: { session: null } });
    getUser.mockImplementation(respondsLater({ data: { user: null }, error: new AuthRetryableFetchError("Failed to fetch", 0) }));

    const { result } = render();
    await waitFor(() => expect(result.current).toBe(USER_ID));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBe(USER_ID);
  });

  it("tampoco degrada si el error no es retryable pero el navegador está offline", async () => {
    setSessionCookie(USER_ID);
    setOnline(false);
    getSession.mockResolvedValue({ data: { session: null } });
    getUser.mockImplementation(respondsLater({ data: { user: null }, error: new Error("algo raro") }));

    const { result } = render();
    await waitFor(() => expect(result.current).toBe(USER_ID));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBe(USER_ID);
  });

  it("con red, una sesión revocada sí degrada a null", async () => {
    setSessionCookie(USER_ID);
    getSession.mockResolvedValue({ data: { session: null } });
    getUser.mockImplementation(respondsLater({ data: { user: null }, error: new AuthApiError("invalid claim", 401, "bad_jwt") }));

    const { result } = render();
    await waitFor(() => expect(result.current).toBeNull());
  });

  it("sin sesión y sin cookie, es null", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    getUser.mockImplementation(respondsLater({ data: { user: null }, error: new AuthApiError("no session", 401, "bad_jwt") }));

    const { result } = render();
    await waitFor(() => expect(result.current).toBeNull());
  });

  it("si getUser() confirma otro usuario, gana el confirmado", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: USER_ID } } } });
    getUser.mockImplementation(respondsLater({ data: { user: { id: OTHER_USER_ID } }, error: null }));

    const { result } = render();
    await waitFor(() => expect(result.current).toBe(OTHER_USER_ID));
  });
});
