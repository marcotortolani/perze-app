import { describe, expect, it } from "vitest";
import { ICONS } from "@/design-system/core/Icon";
import es from "../../../messages/es.json";
import { CATEGORY_ICON_GROUP_MESSAGE_KEY, CATEGORY_ICON_GROUPS, CATEGORY_ICON_MESSAGE_KEY, CATEGORY_ICON_OPTIONS } from "./category-icons";

/** Igual patrón que `src/i18n/messages.test.ts`: navega el JSON por punto. */
function messageExists(dictionary: unknown, key: string): boolean {
  return key.split(".").reduce<unknown>((node, part) => (typeof node === "object" && node !== null ? (node as Record<string, unknown>)[part] : undefined), dictionary) !== undefined;
}

describe("category-icons — el picker no puede ofrecer un ícono roto o sin traducir", () => {
  it("todo ícono de todo grupo es una clave válida de ICONS", () => {
    for (const group of CATEGORY_ICON_GROUPS) {
      for (const icon of group.icons) {
        expect(ICONS, `"${icon}" (grupo ${group.id}) no existe en ICONS`).toHaveProperty(icon);
      }
    }
  });

  it("ningún ícono se repite entre grupos", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const group of CATEGORY_ICON_GROUPS) {
      for (const icon of group.icons) {
        if (seen.has(icon)) dupes.push(icon);
        seen.add(icon);
      }
    }
    expect(dupes).toEqual([]);
  });

  it("CATEGORY_ICON_OPTIONS es exactamente la unión de los grupos", () => {
    const fromGroups = CATEGORY_ICON_GROUPS.flatMap((g) => g.icons);
    expect(CATEGORY_ICON_OPTIONS).toEqual(fromGroups);
  });

  it("todo ícono de los grupos tiene entrada en CATEGORY_ICON_MESSAGE_KEY", () => {
    const all = CATEGORY_ICON_GROUPS.flatMap((g) => g.icons);
    for (const icon of all) {
      expect(CATEGORY_ICON_MESSAGE_KEY, `falta clave de mensaje para "${icon}"`).toHaveProperty(icon);
    }
  });

  it("toda clave de CATEGORY_ICON_MESSAGE_KEY existe en messages/es.json", () => {
    for (const [icon, key] of Object.entries(CATEGORY_ICON_MESSAGE_KEY)) {
      expect(messageExists(es, key), `"${key}" (ícono "${icon}") no existe en es.json`).toBe(true);
    }
  });

  it("todo grupo tiene entrada en CATEGORY_ICON_GROUP_MESSAGE_KEY y existe en es.json", () => {
    for (const group of CATEGORY_ICON_GROUPS) {
      const key = CATEGORY_ICON_GROUP_MESSAGE_KEY[group.id];
      expect(key).toBeDefined();
      expect(messageExists(es, key), `"${key}" (grupo "${group.id}") no existe en es.json`).toBe(true);
    }
  });
});
