import { describe, expect, it } from "vitest";
import { detectRevisionConflict } from "./conflict-detection";

describe("detectRevisionConflict", () => {
  it("is not a conflict when the server matches the local edit's base revision", () => {
    // Local edited rev 3 → 4 (base = 3), server is still at 3.
    expect(detectRevisionConflict(4, 3)).toBe(false);
  });

  it("is a conflict when someone else already pushed a newer revision", () => {
    // Local edited rev 3 → 4 (base = 3), but server is already at 4 (someone else's edit).
    expect(detectRevisionConflict(4, 4)).toBe(true);
  });

  it("is a conflict when the server is behind the expected base (desync)", () => {
    expect(detectRevisionConflict(4, 2)).toBe(true);
  });

  it("is never a conflict when the row doesn't exist on the server yet", () => {
    expect(detectRevisionConflict(1, null)).toBe(false);
  });
});
