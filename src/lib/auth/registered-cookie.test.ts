// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { REGISTERED_COOKIE_NAME, isRegisteredCookieValue, markRegistered } from "./registered-cookie";

afterEach(() => {
  // Expira la cookie seteada por el test anterior — `happy-dom` comparte
  // `document.cookie` entre tests del mismo archivo.
  document.cookie = `${REGISTERED_COOKIE_NAME}=; Max-Age=0; Path=/`;
});

describe("isRegisteredCookieValue", () => {
  it("solo \"1\" cuenta como registrado", () => {
    expect(isRegisteredCookieValue("1")).toBe(true);
    expect(isRegisteredCookieValue("0")).toBe(false);
    expect(isRegisteredCookieValue(undefined)).toBe(false);
    expect(isRegisteredCookieValue("")).toBe(false);
  });
});

describe("markRegistered", () => {
  it("setea la cookie con Max-Age de un año y Path=/", () => {
    markRegistered();
    expect(document.cookie).toContain(`${REGISTERED_COOKIE_NAME}=1`);
  });
});
