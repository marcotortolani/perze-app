import { describe, expect, it } from "vitest";
import { getCategoryAndDescendantIds } from "./category-descendants";

describe("getCategoryAndDescendantIds", () => {
  it("incluye la categoría y sus subcategorías directas", () => {
    const categories = [
      { id: "groceries", parentId: null },
      { id: "groceries-pantry", parentId: "groceries" },
      { id: "groceries-produce", parentId: "groceries" },
      { id: "transport", parentId: null },
    ];
    const ids = getCategoryAndDescendantIds("groceries", categories);
    expect([...ids].sort()).toEqual(["groceries", "groceries-pantry", "groceries-produce"]);
  });

  it("una categoría sin hijos solo se incluye a sí misma", () => {
    const categories = [
      { id: "groceries", parentId: null },
      { id: "groceries-pantry", parentId: "groceries" },
    ];
    const ids = getCategoryAndDescendantIds("groceries-pantry", categories);
    expect([...ids]).toEqual(["groceries-pantry"]);
  });
});
