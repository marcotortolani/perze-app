import { describe, expect, it } from "vitest";
import { isDemoCookieValue } from "./demo-cookie";

describe("isDemoCookieValue", () => {
  it("solo el valor exacto '1' cuenta como demo activo", () => {
    expect(isDemoCookieValue("1")).toBe(true);
  });

  it("undefined, vacío o cualquier otro valor no activan el demo", () => {
    expect(isDemoCookieValue(undefined)).toBe(false);
    expect(isDemoCookieValue("")).toBe(false);
    expect(isDemoCookieValue("0")).toBe(false);
    expect(isDemoCookieValue("true")).toBe(false);
  });
});
