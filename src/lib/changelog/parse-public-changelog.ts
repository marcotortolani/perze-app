export interface PublicChangelogGroup {
  /** `null` cuando la versión trae una sola categoría y no se molestó en encabezarla. */
  heading: string | null;
  items: string[];
}

export interface PublicChangelogVersionEntry {
  type: "version";
  version: string;
  date: string;
  groups: PublicChangelogGroup[];
}

/** Un `## ` que no es una versión — p. ej. "El principio", el origen del proyecto en prosa. Se muestra en la app como texto, intercalado en su lugar cronológico. */
export interface PublicChangelogNarrativeEntry {
  type: "narrative";
  heading: string;
  paragraphs: string[];
}

export type PublicChangelogEntry = PublicChangelogVersionEntry | PublicChangelogNarrativeEntry;

/** Encabezados de `## ` que son instrucciones para quien EDITA el archivo, no contenido para quien lo lee dentro de la app — se descartan del todo, nunca se muestran. */
const META_HEADINGS = new Set(["Cómo escribir una entrada acá"]);

/**
 * Parser de línea, no un parser de Markdown genérico — `CHANGELOG-PUBLIC.md`
 * tiene un formato fijo y documentado en el propio archivo (`## {version} —
 * {fecha}`, `### {categoría}` opcional, `- {item}`, y opcionalmente un `## `
 * narrativo como "El principio" con párrafos de prosa en vez de items).
 */
export function parsePublicChangelog(markdown: string): PublicChangelogEntry[] {
  const lines = markdown.split("\n");
  const entries: PublicChangelogEntry[] = [];
  let current: PublicChangelogEntry | null = null;
  let currentGroup: PublicChangelogGroup | null = null;
  // Prosa de una sección narrativa: líneas consecutivas sin blanco entre
  // medio son EL MISMO párrafo (convención Markdown estándar) — se
  // acumulan acá y se unen con un espacio recién al cortar.
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0 && current?.type === "narrative") {
      current.paragraphs.push(paragraphBuffer.join(" "));
    }
    paragraphBuffer = [];
  };

  for (const line of lines) {
    const versionMatch = line.match(/^##\s+(\S+)\s+—\s+(.+)$/);
    if (versionMatch) {
      flushParagraph();
      current = { type: "version", version: versionMatch[1]!, date: versionMatch[2]!.trim(), groups: [] };
      currentGroup = null;
      entries.push(current);
      continue;
    }

    const genericHeadingMatch = line.match(/^##\s+(.+)$/);
    if (genericHeadingMatch) {
      flushParagraph();
      const heading = genericHeadingMatch[1]!.trim();
      currentGroup = null;
      if (META_HEADINGS.has(heading)) {
        current = null; // las líneas de esta sección (reglas de edición) se ignoran hasta el próximo `## `
      } else {
        current = { type: "narrative", heading, paragraphs: [] };
        entries.push(current);
      }
      continue;
    }

    if (!current) continue;

    if (current.type === "narrative") {
      const text = line.trim();
      if (text) paragraphBuffer.push(text);
      else flushParagraph();
      continue;
    }

    const headingMatch = line.match(/^###\s+(.+)$/);
    if (headingMatch) {
      currentGroup = { heading: headingMatch[1]!.trim(), items: [] };
      current.groups.push(currentGroup);
      continue;
    }

    const itemMatch = line.match(/^-\s+(.+)$/);
    if (itemMatch) {
      if (!currentGroup) {
        currentGroup = { heading: null, items: [] };
        current.groups.push(currentGroup);
      }
      currentGroup.items.push(itemMatch[1]!.trim());
      continue;
    }

    // Continuación de un ítem envuelto en dos líneas (la regla de "dos
    // líneas como máximo" del propio archivo) — la segunda línea viene
    // indentada, sin `- `, así que antes caía en el `continue` de abajo y
    // se perdía en silencio: el ítem se veía cortado a la mitad de la
    // frase dentro de la app. Se une con un espacio al último ítem del
    // grupo activo.
    const continuation = line.trim();
    if (continuation && currentGroup && currentGroup.items.length > 0) {
      const lastIndex = currentGroup.items.length - 1;
      currentGroup.items[lastIndex] = `${currentGroup.items[lastIndex]} ${continuation}`;
    }
  }
  flushParagraph();

  return entries;
}
