import { describe, expect, it } from "vitest";
import { duration, exceptionDuration, spring } from "./springs";

/** Valores exactos de docs/02-design-system.md § 5.1. */
describe("spring curves", () => {
  it("snappy — chips, toggles, keypad", () => {
    expect(spring.snappy).toMatchObject({ stiffness: 500, damping: 32, mass: 0.7 });
  });
  it("default — cards, listas", () => {
    expect(spring.default).toMatchObject({ stiffness: 400, damping: 30, mass: 1 });
  });
  it("soft — sheets, pantallas", () => {
    expect(spring.soft).toMatchObject({ stiffness: 260, damping: 26, mass: 1.1 });
  });
  it("bouncy — solo celebraciones", () => {
    expect(spring.bouncy).toMatchObject({ stiffness: 420, damping: 18, mass: 0.9 });
  });
});

describe("duraciones", () => {
  it("ninguna transición de interfaz supera 320ms", () => {
    expect(Math.max(...Object.values(duration))).toBeLessThanOrEqual(320);
  });

  it("las cuatro excepciones documentadas", () => {
    expect(exceptionDuration.countUp).toBe(400);
    expect(exceptionDuration.save).toBeLessThanOrEqual(700);
    expect(exceptionDuration.celebration).toBe(900);
    expect(exceptionDuration.lineDraw).toBe(600);
  });
});
