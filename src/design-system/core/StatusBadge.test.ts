import { describe, expect, it } from "vitest";
import { resolveBadgeStatus } from "./StatusBadge";

describe("resolveBadgeStatus — CON-09", () => {
  it("neutral con menos de 7 días no escala", () => {
    expect(resolveBadgeStatus("neutral", 6)).toBe("neutral");
    expect(resolveBadgeStatus("neutral", 0)).toBe("neutral");
  });

  it("neutral con 7 días o más escala a warning", () => {
    expect(resolveBadgeStatus("neutral", 7)).toBe("warning");
    expect(resolveBadgeStatus("neutral", 30)).toBe("warning");
  });

  it("sin ageDays, neutral se queda neutral", () => {
    expect(resolveBadgeStatus("neutral", undefined)).toBe("neutral");
  });

  it("otros estados nunca escalan por tiempo, son explícitos", () => {
    expect(resolveBadgeStatus("good", 30)).toBe("good");
    expect(resolveBadgeStatus("warning", 30)).toBe("warning");
    expect(resolveBadgeStatus("critical", 30)).toBe("critical");
  });
});
