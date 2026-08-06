import { describe, expect, it } from "vitest";
import { accountMatchesScope } from "./match-scope";

describe("accountMatchesScope", () => {
  it("'all' incluye cualquier visibilidad", () => {
    expect(accountMatchesScope("private", "all")).toBe(true);
    expect(accountMatchesScope("household", "all")).toBe(true);
    expect(accountMatchesScope("custom", "all")).toBe(true);
  });

  it("'personal' solo incluye private", () => {
    expect(accountMatchesScope("private", "personal")).toBe(true);
    expect(accountMatchesScope("household", "personal")).toBe(false);
    expect(accountMatchesScope("custom", "personal")).toBe(false);
  });

  it("'household' excluye private, incluye household y custom", () => {
    expect(accountMatchesScope("private", "household")).toBe(false);
    expect(accountMatchesScope("household", "household")).toBe(true);
    expect(accountMatchesScope("custom", "household")).toBe(true);
  });
});
