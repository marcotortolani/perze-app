import { describe, expect, it } from "vitest";
import { isAccessApprovalCookieValidFor } from "./access-approval-cookie";

describe("isAccessApprovalCookieValidFor", () => {
  it("solo es válida si el valor coincide con el userId exacto", () => {
    expect(isAccessApprovalCookieValidFor("user-1", "user-1")).toBe(true);
  });

  it("no vale para otro usuario en el mismo dispositivo", () => {
    expect(isAccessApprovalCookieValidFor("user-1", "user-2")).toBe(false);
  });

  it("no vale sin cookie", () => {
    expect(isAccessApprovalCookieValidFor("user-1", undefined)).toBe(false);
  });
});
