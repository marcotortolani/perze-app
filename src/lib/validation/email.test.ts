import { describe, expect, it } from "vitest";
import { diagnoseEmail, emailSchema, normalizeEmail, optionalEmailSchema, suggestEmail } from "./email";

describe("normalizeEmail", () => {
  it("baja a minúscula y saca espacios", () => {
    expect(normalizeEmail("Ana.Perez@Gmail.com")).toBe("ana.perez@gmail.com");
    expect(normalizeEmail("  ana@gmail.com ")).toBe("ana@gmail.com");
  });
});

describe("emailSchema", () => {
  it("normaliza antes de validar", () => {
    expect(emailSchema.parse("  Ana@Gmail.COM ")).toBe("ana@gmail.com");
  });

  it("rechaza lo que no es un email", () => {
    expect(emailSchema.safeParse("ana").success).toBe(false);
    expect(emailSchema.safeParse("ana@gmail").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
  });
});

describe("optionalEmailSchema", () => {
  it("vacío es válido y da null", () => {
    expect(optionalEmailSchema.parse("")).toBeNull();
    expect(optionalEmailSchema.parse("   ")).toBeNull();
  });

  it("escrito a medias no pasa", () => {
    expect(optionalEmailSchema.safeParse("ana@").success).toBe(false);
  });

  it("válido sale en minúscula", () => {
    expect(optionalEmailSchema.parse("ANA@Gmail.com")).toBe("ana@gmail.com");
  });
});

describe("diagnoseEmail", () => {
  it("no marca error si está vacío o es válido", () => {
    expect(diagnoseEmail("")).toBeNull();
    expect(diagnoseEmail("Ana@Gmail.com")).toBeNull();
  });

  it("distingue el @ del final del dominio", () => {
    expect(diagnoseEmail("ana")).toBe("missingAt");
    expect(diagnoseEmail("ana@gmail")).toBe("missingDomain");
    expect(diagnoseEmail("ana@")).toBe("invalid");
  });
});

describe("suggestEmail", () => {
  it("propone la corrección en vez de nombrarla", () => {
    expect(suggestEmail("ana")).toBe("ana@gmail.com");
    expect(suggestEmail("ana@gmail")).toBe("ana@gmail.com");
  });

  it("no sugiere nada cuando no hay nada razonable", () => {
    expect(suggestEmail("")).toBeNull();
    expect(suggestEmail("ana@gmail.com")).toBeNull();
    expect(suggestEmail("ana@")).toBeNull();
  });
});
