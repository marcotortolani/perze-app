// Exporta las plantillas de Auth (`src/emails/auth/*.tsx`) a
// `supabase/templates/*.html` — pnpm email:export.
//
// `supabase config push` rechaza cambios de plantilla en plan free
// (`docs/mejora-auth-oauth-y-email.md` § 5), así que el HTML generado acá
// se pega a mano en el Dashboard (Authentication → Emails). El archivo
// commiteado en `supabase/templates/` es la fuente de verdad de lo que
// *debería* estar pegado — `src/emails/auth/templates.test.ts` falla si
// alguien edita el TSX y se olvida de correr este script.
//
// No hay loader de TSX en un script `.mjs` corrido con `node` a pelo: se
// bundlea con esbuild (ya devDependency, mismo que usa Vitest) a un ESM
// temporal y se importa dinámicamente.
import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { render } from "@react-email/render";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "supabase/templates");

const TEMPLATES = [
  { entry: "src/emails/auth/magic-link.tsx", out: "magic_link.html" },
  { entry: "src/emails/auth/recovery.tsx", out: "recovery.html" },
];

const GENERATED_HEADER = `<!--
  Generado por \`pnpm email:export\` desde \`src/emails/auth/*.tsx\`.
  No editar a mano — el próximo export lo pisa sin avisar. Para cambiar
  el contenido, editar el componente React y volver a correr el script.
-->
`;

async function renderTemplate(entry) {
  // Bundle completo, sin `external`: el archivo temporal vive fuera del
  // árbol del proyecto (`os.tmpdir()`), así que la resolución de módulos
  // de Node no encontraría `node_modules` subiendo desde ahí si
  // dejáramos algo afuera.
  const bundle = await build({
    entryPoints: [path.join(ROOT, entry)],
    bundle: true,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    write: false,
  });

  const tmpDir = await mkdtemp(path.join(tmpdir(), "perze-email-"));
  const tmpFile = path.join(tmpDir, "template.mjs");
  try {
    await writeFile(tmpFile, bundle.outputFiles[0].text);
    const mod = await import(`file://${tmpFile}`);
    const Component = mod.default;
    return await render(Component({}), { pretty: true });
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  for (const { entry, out } of TEMPLATES) {
    const html = await renderTemplate(entry);
    const outPath = path.join(OUT_DIR, out);
    await writeFile(outPath, GENERATED_HEADER + html);
    console.log(outPath);
  }
}

main();
