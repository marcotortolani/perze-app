import { describe, expect, it } from "vitest";
import { buildNewCategoryInput, findExistingCategoryByName } from "./create-category";
import type { CategoryRow } from "@/lib/db/schema";

function category(id: string, name: string, sortOrder: number): CategoryRow {
  return {
    id,
    householdId: "hh-1",
    parentId: null,
    name,
    i18nKey: null,
    icon: "tag",
    color: "var(--data-1)",
    kind: "expense",
    nature: "variable",
    isSystem: false,
    sortOrder,
    archivedAt: null,
    visibility: "household",
    ownerId: null,
    createdBy: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    clientRev: 1,
  };
}

describe("buildNewCategoryInput", () => {
  it("recorta el nombre, marca isSystem false e i18nKey null", () => {
    const input = buildNewCategoryInput({ householdId: "hh-1", name: "  Mascotas  ", kind: "expense", createdBy: "user-1", existing: [] });
    expect(input.name).toBe("Mascotas");
    expect(input.isSystem).toBe(false);
    expect(input.i18nKey).toBeNull();
    expect(input.nature).toBe("variable");
  });

  it("el sortOrder queda después del máximo existente", () => {
    const existing = [category("a", "A", 3), category("b", "B", 7)];
    const input = buildNewCategoryInput({ householdId: "hh-1", name: "Nueva", kind: "expense", createdBy: "user-1", existing });
    expect(input.sortOrder).toBe(8);
  });

  it("sin categorías existentes, el sortOrder arranca en 0", () => {
    const input = buildNewCategoryInput({ householdId: "hh-1", name: "Primera", kind: "expense", createdBy: "user-1", existing: [] });
    expect(input.sortOrder).toBe(0);
  });

  it("con parent, hereda parentId, kind y color — sin importar el kind pedido", () => {
    const parent = { ...category("p", "Salud", 0), kind: "expense" as const, color: "var(--data-3)" };
    const input = buildNewCategoryInput({ householdId: "hh-1", name: "Farmacia", kind: "income", createdBy: "user-1", existing: [parent], parent });
    expect(input.parentId).toBe("p");
    expect(input.kind).toBe("expense");
    expect(input.color).toBe("var(--data-3)");
  });

  it("sin parent, los defaults quedan idénticos a hoy (parentId null, color rotativo)", () => {
    const input = buildNewCategoryInput({ householdId: "hh-1", name: "Nueva", kind: "expense", createdBy: "user-1", existing: [] });
    expect(input.parentId).toBeNull();
    expect(input.color).toBe("var(--data-1)");
  });

  it("icon respeta el default 'tag' y el explícito si se pasa", () => {
    const withoutIcon = buildNewCategoryInput({ householdId: "hh-1", name: "Nueva", kind: "expense", createdBy: "user-1", existing: [] });
    expect(withoutIcon.icon).toBe("tag");

    const withIcon = buildNewCategoryInput({ householdId: "hh-1", name: "Nueva", kind: "expense", createdBy: "user-1", existing: [], icon: "bus" });
    expect(withIcon.icon).toBe("bus");
  });
});

describe("findExistingCategoryByName", () => {
  const label = (c: CategoryRow) => c.name;
  const existing = [category("a", "Café", 0), category("b", "Transporte", 1)];

  it("encuentra sin distinguir acentos ni mayúsculas", () => {
    expect(findExistingCategoryByName("cafe", existing, "expense", label)?.id).toBe("a");
    expect(findExistingCategoryByName("CAFÉ", existing, "expense", label)?.id).toBe("a");
  });

  it("sin match devuelve undefined", () => {
    expect(findExistingCategoryByName("mascotas", existing, "expense", label)).toBeUndefined();
  });
});
