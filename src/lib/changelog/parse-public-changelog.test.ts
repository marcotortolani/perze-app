import { describe, expect, it } from "vitest";
import { parsePublicChangelog, type PublicChangelogVersionEntry } from "./parse-public-changelog";

describe("parsePublicChangelog", () => {
  it("ignora la sección de reglas de edición (heading especial) antes de la primera versión", () => {
    const md = `# Título\n\n## Cómo escribir una entrada acá\n\nAlgunas reglas acá que no son una versión.\n\n## 0.29.10 — 6 de agosto de 2026\n\n- Un cambio.\n`;
    const entries = parsePublicChangelog(md);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: "version", version: "0.29.10" });
  });

  it("parsea versión, fecha, categorías e items", () => {
    const md = `## 0.29.9 — 6 de agosto de 2026\n\n### Arreglado\n\n- Primer arreglo.\n- Segundo arreglo.\n\n### Nuevo\n\n- Algo nuevo.\n`;
    const entries = parsePublicChangelog(md);
    expect(entries).toHaveLength(1);
    const entry = entries[0] as PublicChangelogVersionEntry;
    expect(entry.version).toBe("0.29.9");
    expect(entry.date).toBe("6 de agosto de 2026");
    expect(entry.groups).toEqual([
      { heading: "Arreglado", items: ["Primer arreglo.", "Segundo arreglo."] },
      { heading: "Nuevo", items: ["Algo nuevo."] },
    ]);
  });

  it("una versión con una sola categoría sin encabezar agrupa los items bajo heading null", () => {
    const md = `## 0.29.4 — 6 de agosto de 2026\n\n- Un solo cambio, sin categoría.\n`;
    const entries = parsePublicChangelog(md);
    const entry = entries[0] as PublicChangelogVersionEntry;
    expect(entry.groups).toEqual([{ heading: null, items: ["Un solo cambio, sin categoría."] }]);
  });

  it("varias versiones seguidas se separan bien", () => {
    const md = `## 0.29.10 — 6 de agosto de 2026\n\n- A.\n\n## 0.29.9 — 6 de agosto de 2026\n\n- B.\n`;
    const entries = parsePublicChangelog(md);
    expect(entries.map((e) => (e as PublicChangelogVersionEntry).version)).toEqual(["0.29.10", "0.29.9"]);
  });

  it("markdown vacío o sin versiones devuelve lista vacía", () => {
    expect(parsePublicChangelog("")).toEqual([]);
    expect(parsePublicChangelog("solo texto, sin encabezados")).toEqual([]);
  });

  it("un ítem envuelto en dos líneas (regla de \"dos líneas como máximo\") se une, no se corta", () => {
    const md = `## 0.29.15 — 6 de agosto de 2026\n\n### Arreglado\n\n- Al entrar a "mi portfolio" ya no ves nunca "$ 0,00" en una posición mientras se actualiza el\n  precio — se muestra el último valor conocido hasta que llega el nuevo.\n- Un segundo ítem, de una sola línea.\n`;
    const entries = parsePublicChangelog(md);
    const entry = entries[0] as PublicChangelogVersionEntry;
    expect(entry.groups).toEqual([
      {
        heading: "Arreglado",
        items: [
          'Al entrar a "mi portfolio" ya no ves nunca "$ 0,00" en una posición mientras se actualiza el precio — se muestra el último valor conocido hasta que llega el nuevo.',
          "Un segundo ítem, de una sola línea.",
        ],
      },
    ]);
  });

  it("un `## ` que no matchea el formato de versión es una entrada narrativa, intercalada en su lugar", () => {
    const md = `## 0.2.0 — 28 de julio de 2026\n\n- Algo.\n\n## El principio\n\nPrimera línea de un párrafo\nque sigue en la línea de abajo.\n\nSegundo párrafo, separado por una línea en blanco.\n\n## 0.1.0 — 30 de mayo de 2026\n\n- Otra cosa.\n`;
    const entries = parsePublicChangelog(md);
    expect(entries.map((e) => e.type)).toEqual(["version", "narrative", "version"]);
    expect(entries[1]).toEqual({
      type: "narrative",
      heading: "El principio",
      paragraphs: ["Primera línea de un párrafo que sigue en la línea de abajo.", "Segundo párrafo, separado por una línea en blanco."],
    });
  });
});
