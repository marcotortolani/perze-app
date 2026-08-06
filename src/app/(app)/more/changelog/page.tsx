import { readFile } from "node:fs/promises";
import path from "node:path";
import { parsePublicChangelog } from "@/lib/changelog/parse-public-changelog";
import { ChangelogContent } from "./ChangelogContent";

/**
 * Server Component a propósito: `CHANGELOG-PUBLIC.md` es un archivo del
 * repo, no un dato de household — se lee una vez en el servidor (sin
 * cliente de Supabase, sin fetch) y se manda ya parseado. `usePageHeader`
 * es un hook de cliente, por eso el render en sí vive en
 * `ChangelogContent` ("use client").
 */
export default async function ChangelogPage() {
  const raw = await readFile(path.join(process.cwd(), "CHANGELOG-PUBLIC.md"), "utf-8");
  const entries = parsePublicChangelog(raw);
  return <ChangelogContent entries={entries} />;
}
