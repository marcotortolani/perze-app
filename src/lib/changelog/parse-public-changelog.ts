export interface PublicChangelogGroup {
  /** `null` cuando la versión trae una sola categoría y no se molestó en encabezarla. */
  heading: string | null;
  items: string[];
}

export interface PublicChangelogEntry {
  version: string;
  date: string;
  groups: PublicChangelogGroup[];
}

/**
 * Parser de línea, no un parser de Markdown genérico — `CHANGELOG-PUBLIC.md`
 * tiene un formato fijo y documentado en el propio archivo (`## {version} —
 * {fecha}`, `### {categoría}` opcional, `- {item}`). Todo lo que esté ANTES
 * del primer `## ` (el título del archivo y las reglas de cómo escribir una
 * entrada) se ignora a propósito: esa sección es para quien edita el
 * archivo, no para mostrar dentro de la app.
 */
export function parsePublicChangelog(markdown: string): PublicChangelogEntry[] {
  const lines = markdown.split("\n");
  const entries: PublicChangelogEntry[] = [];
  let current: PublicChangelogEntry | null = null;
  let currentGroup: PublicChangelogGroup | null = null;

  for (const line of lines) {
    const versionMatch = line.match(/^##\s+(\S+)\s+—\s+(.+)$/);
    if (versionMatch) {
      current = { version: versionMatch[1]!, date: versionMatch[2]!.trim(), groups: [] };
      currentGroup = null;
      entries.push(current);
      continue;
    }
    if (!current) continue;

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
    }
  }

  return entries;
}
