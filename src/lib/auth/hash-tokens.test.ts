import { describe, expect, it } from "vitest";
import { parseAuthHash } from "./hash-tokens";

describe("parseAuthHash", () => {
  it("extrae los tokens del fragment que deja el verify de GoTrue", () => {
    const hash =
      "#access_token=eyJabc&expires_in=3600&refresh_token=v1.MTc&token_type=bearer&type=magiclink";
    expect(parseAuthHash(hash)).toEqual({
      kind: "tokens",
      accessToken: "eyJabc",
      refreshToken: "v1.MTc",
    });
  });

  it("acepta el hash sin el # inicial", () => {
    expect(parseAuthHash("access_token=a&refresh_token=b")).toEqual({
      kind: "tokens",
      accessToken: "a",
      refreshToken: "b",
    });
  });

  it("devuelve el error_code cuando el link venció o ya se usó", () => {
    const hash = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid";
    expect(parseAuthHash(hash)).toEqual({ kind: "error", code: "otp_expired" });
  });

  it("cae a `error` cuando GoTrue no manda error_code", () => {
    expect(parseAuthHash("#error=server_error")).toEqual({ kind: "error", code: "server_error" });
  });

  it("ignora un access_token sin refresh_token (no alcanza para una sesión)", () => {
    expect(parseAuthHash("#access_token=a")).toBeNull();
  });

  it("ignora hashes vacíos o ajenos (anclas de navegación)", () => {
    expect(parseAuthHash("")).toBeNull();
    expect(parseAuthHash("#")).toBeNull();
    expect(parseAuthHash("#seccion-2")).toBeNull();
  });
});
