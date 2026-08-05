// Genera el wordmark que usan los emails (`src/emails/components/Wordmark.tsx`)
// a partir de `perze-design/perze-brand/assets/wordmark-light.svg` — mismo
// patrón que `scripts/generate-splash-screens.mjs`.
//
// Un cliente de mail no dibuja SVG de forma confiable (Gmail y Outlook lo
// descartan): el wordmark viaja como un único PNG servido desde
// `public/email/`, renderizado a 3x el alto que usa `Wordmark.tsx` en el
// email (22px) para que quede nítido en pantallas retina — el `<Img>` lo
// escala hacia abajo con `height`/`width` explícitos. Se versiona el
// resultado — volver a correr este script a mano si el wordmark cambia.
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const BRAND = path.join(ROOT, "perze-design/perze-brand/assets");
const OUT_DIR = path.join(ROOT, "public/email");

const DISPLAY_HEIGHT = 22; // el que usa Wordmark.tsx por default
const RENDER_SCALE = 3;
const VIEWBOX_RATIO = 144.34 / 42.0;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const svg = readFileSync(path.join(BRAND, "wordmark-light.svg"), "utf8");
  const targetHeight = DISPLAY_HEIGHT * RENDER_SCALE;
  const targetWidth = Math.round(targetHeight * VIEWBOX_RATIO);
  const png = await sharp(Buffer.from(svg)).resize(targetWidth, targetHeight).png().toBuffer();

  const outPath = path.join(OUT_DIR, "wordmark-light.png");
  await sharp(png).toFile(outPath);
  console.log(outPath);
}

main();
