import { describe, expect, it } from "vitest";
import { shouldCheckForUpdate, UPDATE_CHECK_MIN_INTERVAL_MS } from "./update-check";

const NOW = 1_800_000_000_000;

describe("shouldCheckForUpdate", () => {
  it("chequea la primera vez del documento", () => {
    expect(shouldCheckForUpdate({ now: NOW, lastCheckAt: null, online: true })).toBe(true);
  });

  it("no chequea dentro del piso de tiempo", () => {
    expect(shouldCheckForUpdate({ now: NOW, lastCheckAt: NOW - 60_000, online: true })).toBe(false);
  });

  it("chequea justo al cumplirse el piso", () => {
    expect(shouldCheckForUpdate({ now: NOW, lastCheckAt: NOW - UPDATE_CHECK_MIN_INTERVAL_MS, online: true })).toBe(true);
  });

  it("chequea pasado el piso", () => {
    expect(shouldCheckForUpdate({ now: NOW, lastCheckAt: NOW - UPDATE_CHECK_MIN_INTERVAL_MS - 1, online: true })).toBe(true);
  });

  it("nunca chequea sin conexión, ni siquiera la primera vez", () => {
    // `registration.update()` offline solo puede fallar, y ese ruido tapa
    // los errores de registro que sí importan.
    expect(shouldCheckForUpdate({ now: NOW, lastCheckAt: null, online: false })).toBe(false);
  });

  it("no chequea sin conexión aunque haya pasado el piso", () => {
    expect(shouldCheckForUpdate({ now: NOW, lastCheckAt: NOW - UPDATE_CHECK_MIN_INTERVAL_MS * 10, online: false })).toBe(false);
  });

  it("el piso es de dos horas — bajarlo tiene costo: cada versión nueva baja el precache entero", () => {
    expect(UPDATE_CHECK_MIN_INTERVAL_MS).toBe(2 * 60 * 60 * 1000);
  });
});
