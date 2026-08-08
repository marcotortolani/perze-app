import { describe, expect, it } from "vitest";
import { boolOr, nullableNumberOr, nullableStringOr, oneOf, sanitizedPersist, stringArrayOr, stringOr } from "./persist-sanitize";

describe("oneOf", () => {
  const sanitize = oneOf(["a", "b", "c"] as const, "a");

  it("conserva un valor permitido", () => {
    expect(sanitize("b")).toBe("b");
  });

  it("cae al fallback si el valor no está en la lista", () => {
    expect(sanitize("z")).toBe("a");
  });

  it("cae al fallback con undefined/null/tipo equivocado", () => {
    expect(sanitize(undefined)).toBe("a");
    expect(sanitize(null)).toBe("a");
    expect(sanitize(42)).toBe("a");
  });
});

describe("boolOr", () => {
  const sanitize = boolOr(true);

  it("conserva un booleano", () => {
    expect(sanitize(false)).toBe(false);
  });

  it("cae al fallback con undefined/null/tipo equivocado", () => {
    expect(sanitize(undefined)).toBe(true);
    expect(sanitize(null)).toBe(true);
    expect(sanitize("false")).toBe(true);
  });
});

describe("stringOr", () => {
  const sanitize = stringOr("default");

  it("conserva un string", () => {
    expect(sanitize("hola")).toBe("hola");
  });

  it("cae al fallback con undefined/null/tipo equivocado", () => {
    expect(sanitize(undefined)).toBe("default");
    expect(sanitize(null)).toBe("default");
    expect(sanitize(5)).toBe("default");
  });
});

describe("nullableStringOr", () => {
  const sanitize = nullableStringOr();

  it("conserva un string", () => {
    expect(sanitize("hola")).toBe("hola");
  });

  it("cae a null con undefined/null/tipo equivocado", () => {
    expect(sanitize(undefined)).toBeNull();
    expect(sanitize(null)).toBeNull();
    expect(sanitize(5)).toBeNull();
  });
});

describe("nullableNumberOr", () => {
  const sanitize = nullableNumberOr();

  it("conserva un número finito", () => {
    expect(sanitize(2026)).toBe(2026);
  });

  it("cae a null con undefined/null/NaN/tipo equivocado", () => {
    expect(sanitize(undefined)).toBeNull();
    expect(sanitize(null)).toBeNull();
    expect(sanitize(NaN)).toBeNull();
    expect(sanitize("2026")).toBeNull();
  });
});

describe("stringArrayOr", () => {
  const sanitize = stringArrayOr();

  it("conserva un array de strings", () => {
    expect(sanitize(["a", "b"])).toEqual(["a", "b"]);
  });

  it("filtra los elementos que no son strings", () => {
    expect(sanitize(["a", 1, null, "b"])).toEqual(["a", "b"]);
  });

  it("cae a array vacío con undefined/null/tipo equivocado", () => {
    expect(sanitize(undefined)).toEqual([]);
    expect(sanitize(null)).toEqual([]);
    expect(sanitize("no-array")).toEqual([]);
  });
});

describe("sanitizedPersist", () => {
  interface State {
    count: number;
    setCount: (n: number) => void;
  }

  const sanitize = (persisted: unknown) => {
    const p = (persisted ?? {}) as Record<string, unknown>;
    return { count: typeof p.count === "number" ? p.count : 0 };
  };

  it("migrate devuelve solo las claves saneadas", () => {
    const { migrate } = sanitizedPersist<State, { count: number }>(sanitize);
    expect(migrate({ count: 5 }, 0)).toEqual({ count: 5 });
    expect(migrate({ count: "bad" }, 0)).toEqual({ count: 0 });
  });

  it("merge conserva los métodos de `current` y sanea los datos de `persisted`", () => {
    const { merge } = sanitizedPersist<State, { count: number }>(sanitize);
    const setCount = () => {};
    const current: State = { count: 0, setCount };
    const result = merge({ count: 7 }, current);
    expect(result).toEqual({ count: 7, setCount });
    expect(result.setCount).toBe(setCount);
  });

  it("merge cae a defaults si lo persistido está corrupto", () => {
    const { merge } = sanitizedPersist<State, { count: number }>(sanitize);
    const setCount = () => {};
    const current: State = { count: 0, setCount };
    const result = merge({ count: "corrupto" }, current);
    expect(result.count).toBe(0);
  });
});
