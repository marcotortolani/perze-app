// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPersistedSessionUserId } from "./persisted-session";

vi.mock("@/env", () => ({ env: { NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijkl.supabase.co" } }));

const KEY = "sb-abcdefghijkl-auth-token";
const USER_ID = "11111111-1111-4111-8111-111111111111";

/** Igual que `@supabase/ssr` con `cookieEncoding: "base64url"`: JSON → base64url → prefijo `base64-`. */
function encode(payload: unknown): string {
  const base64url = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  return `base64-${base64url}`;
}

function setCookies(entries: Array<[string, string]>): void {
  for (const [name, value] of entries) {
    document.cookie = `${name}=${encodeURIComponent(value)}`;
  }
}

beforeEach(() => {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
});

describe("readPersistedSessionUserId", () => {
  it("devuelve el uid de una cookie única codificada en base64url", () => {
    setCookies([[KEY, encode({ user: { id: USER_ID }, expires_at: 1 })]]);
    expect(readPersistedSessionUserId()).toBe(USER_ID);
  });

  it("acepta el valor sin el prefijo base64- (cookieEncoding raw)", () => {
    setCookies([[KEY, JSON.stringify({ user: { id: USER_ID } })]]);
    expect(readPersistedSessionUserId()).toBe(USER_ID);
  });

  it("recompone los chunks POR ORDEN NUMÉRICO, no por orden de aparición", () => {
    // El navegador no garantiza el orden de `document.cookie`. Concatenar
    // como vienen arma un base64 roto en cuanto hay más de un chunk, que es
    // el caso de cualquier sesión con metadata de usuario grande.
    const value = encode({ user: { id: USER_ID }, filler: "x".repeat(200) });
    const cut = Math.floor(value.length / 3);
    setCookies([
      [`${KEY}.2`, value.slice(cut * 2)],
      [`${KEY}.0`, value.slice(0, cut)],
      [`${KEY}.1`, value.slice(cut, cut * 2)],
    ]);
    expect(readPersistedSessionUserId()).toBe(USER_ID);
  });

  it("corta en el primer índice faltante en vez de saltearlo", () => {
    // `.0` + `.2` sin `.1` es una escritura parcial: lo que se puede armar
    // no es la sesión, así que vale menos que nada.
    const value = encode({ user: { id: USER_ID }, filler: "x".repeat(200) });
    const cut = Math.floor(value.length / 2);
    setCookies([
      [`${KEY}.0`, value.slice(0, cut)],
      [`${KEY}.2`, value.slice(cut)],
    ]);
    expect(readPersistedSessionUserId()).toBeNull();
  });

  it("devuelve null sin cookie", () => {
    expect(readPersistedSessionUserId()).toBeNull();
  });

  it("devuelve null con base64 corrupto, sin tirar", () => {
    setCookies([[KEY, "base64-@@@no-es-base64@@@"]]);
    expect(readPersistedSessionUserId()).toBeNull();
  });

  it("devuelve null si el JSON no tiene user.id", () => {
    setCookies([[KEY, encode({ access_token: "abc" })]]);
    expect(readPersistedSessionUserId()).toBeNull();
  });

  it("devuelve null si user.id no es un string no vacío", () => {
    setCookies([[KEY, encode({ user: { id: "" } })]]);
    expect(readPersistedSessionUserId()).toBeNull();
  });

  it("ignora la cookie de OTRO proyecto de Supabase", () => {
    // Sin esta comprobación, un self-host o un cambio de proyecto podría
    // abrir la base Dexie de una identidad que no es de este backend.
    setCookies([["sb-otroproyecto-auth-token", encode({ user: { id: USER_ID } })]]);
    expect(readPersistedSessionUserId()).toBeNull();
  });
});
