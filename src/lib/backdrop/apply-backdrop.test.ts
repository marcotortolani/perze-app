// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { applyBackdropPreference, getStoredBackdropPreference } from "./apply-backdrop";
import { BACKDROP_STORAGE_KEY } from "./constants";

describe("getStoredBackdropPreference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("cae al default (apagado, normal/normal) sin nada guardado", () => {
    expect(getStoredBackdropPreference()).toEqual({ enabled: false, density: "normal", intensity: "normal" });
  });

  it("descarta un JSON corrupto y cae al default", () => {
    localStorage.setItem(BACKDROP_STORAGE_KEY, "{not json");
    expect(getStoredBackdropPreference()).toEqual({ enabled: false, density: "normal", intensity: "normal" });
  });

  it("descarta valores de density/intensity fuera del rango elegible", () => {
    localStorage.setItem(BACKDROP_STORAGE_KEY, JSON.stringify({ enabled: true, density: "huge", intensity: "max" }));
    expect(getStoredBackdropPreference()).toEqual({ enabled: true, density: "normal", intensity: "normal" });
  });

  it("preserva valores válidos", () => {
    localStorage.setItem(BACKDROP_STORAGE_KEY, JSON.stringify({ enabled: true, density: "tight", intensity: "strong" }));
    expect(getStoredBackdropPreference()).toEqual({ enabled: true, density: "tight", intensity: "strong" });
  });

  it("acepta el paso más intenso ('vivid')", () => {
    localStorage.setItem(BACKDROP_STORAGE_KEY, JSON.stringify({ enabled: true, density: "normal", intensity: "vivid" }));
    expect(getStoredBackdropPreference()).toEqual({ enabled: true, density: "normal", intensity: "vivid" });
  });
});

describe("applyBackdropPreference", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-backdrop");
    document.documentElement.removeAttribute("data-backdrop-density");
    document.documentElement.removeAttribute("data-backdrop-intensity");
  });

  it("escribe los data-attribute saneados en <html> y persiste", () => {
    applyBackdropPreference({ enabled: true, density: "loose", intensity: "subtle" });
    expect(document.documentElement.getAttribute("data-backdrop")).toBe("on");
    expect(document.documentElement.getAttribute("data-backdrop-density")).toBe("loose");
    expect(document.documentElement.getAttribute("data-backdrop-intensity")).toBe("subtle");
    expect(JSON.parse(localStorage.getItem(BACKDROP_STORAGE_KEY)!)).toEqual({ enabled: true, density: "loose", intensity: "subtle" });
  });

  it("clampea un valor fuera de rango al default antes de escribir", () => {
    // @ts-expect-error -- valor deliberadamente fuera del tipo, para probar el clamp en runtime.
    applyBackdropPreference({ enabled: true, density: "huge", intensity: "subtle" });
    expect(document.documentElement.getAttribute("data-backdrop-density")).toBe("normal");
  });
});
