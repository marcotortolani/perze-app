import { describe, expect, it } from "vitest";
import { parsePublicChangelog } from "./parse-public-changelog";

describe("parsePublicChangelog", () => {
  it("ignora todo lo que está antes del primer encabezado de versión", () => {
    const md = `# Título\n\nAlgunas reglas acá que no son una versión.\n\n## 0.29.10 — 6 de agosto de 2026\n\n- Un cambio.\n`;
    const entries = parsePublicChangelog(md);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.version).toBe("0.29.10");
  });

  it("parsea versión, fecha, categorías e items", () => {
    const md = `## 0.29.9 — 6 de agosto de 2026\n\n### Arreglado\n\n- Primer arreglo.\n- Segundo arreglo.\n\n### Nuevo\n\n- Algo nuevo.\n`;
    const entries = parsePublicChangelog(md);
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry!.version).toBe("0.29.9");
    expect(entry!.date).toBe("6 de agosto de 2026");
    expect(entry!.groups).toEqual([
      { heading: "Arreglado", items: ["Primer arreglo.", "Segundo arreglo."] },
      { heading: "Nuevo", items: ["Algo nuevo."] },
    ]);
  });

  it("una versión con una sola categoría sin encabezar agrupa los items bajo heading null", () => {
    const md = `## 0.29.4 — 6 de agosto de 2026\n\n- Un solo cambio, sin categoría.\n`;
    const entries = parsePublicChangelog(md);
    expect(entries[0]!.groups).toEqual([{ heading: null, items: ["Un solo cambio, sin categoría."] }]);
  });

  it("varias versiones seguidas se separan bien", () => {
    const md = `## 0.29.10 — 6 de agosto de 2026\n\n- A.\n\n## 0.29.9 — 6 de agosto de 2026\n\n- B.\n`;
    const entries = parsePublicChangelog(md);
    expect(entries.map((e) => e.version)).toEqual(["0.29.10", "0.29.9"]);
  });

  it("markdown vacío o sin versiones devuelve lista vacía", () => {
    expect(parsePublicChangelog("")).toEqual([]);
    expect(parsePublicChangelog("solo texto, sin encabezados")).toEqual([]);
  });
});
