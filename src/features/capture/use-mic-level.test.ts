import { describe, expect, it } from "vitest";
import { rmsFromTimeDomain } from "./use-mic-level";

describe("rmsFromTimeDomain", () => {
  it("silencio (todo en 128) da 0", () => {
    const data = new Uint8Array(8).fill(128);
    expect(rmsFromTimeDomain(data)).toBe(0);
  });

  it("señal a máxima amplitud (0/255 alternado) da ~1", () => {
    // 0 y 255 normalizan a -1 y 127/128 (no exactamente ±1: el byte 255 es el máximo
    // representable, no un 256 imposible) — el RMS resultante queda muy cerca de 1.
    const data = new Uint8Array([0, 255, 0, 255]);
    expect(rmsFromTimeDomain(data)).toBeGreaterThan(0.99);
    expect(rmsFromTimeDomain(data)).toBeLessThanOrEqual(1);
  });

  it("una onda intermedia da un valor entre 0 y 1", () => {
    const data = new Uint8Array([128, 160, 192, 160, 128, 96, 64, 96]);
    const rms = rmsFromTimeDomain(data);
    expect(rms).toBeGreaterThan(0);
    expect(rms).toBeLessThan(1);
  });

  it("buffer vacío no revienta y da 0", () => {
    expect(rmsFromTimeDomain(new Uint8Array(0))).toBe(0);
  });

  it("nunca devuelve fuera de 0..1", () => {
    const data = new Uint8Array([0, 255, 128, 1, 254]);
    const rms = rmsFromTimeDomain(data);
    expect(rms).toBeGreaterThanOrEqual(0);
    expect(rms).toBeLessThanOrEqual(1);
  });
});
