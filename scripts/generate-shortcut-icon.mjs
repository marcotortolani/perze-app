// Genera el ícono del shortcut de la PWA "Cargar un gasto" — node scripts/generate-shortcut-icon.mjs
//
// El manifest declaraba el shortcut sin `icons`: Android cae a un ícono
// genérico (o nada) en el menú de mantener presionado. Se parte del ícono
// de la app ya generado (`public/icons/icon-512.png`) y se le compone una
// insignia violeta con un "+" — mismo `--violet-fill` que usa el FAB de
// "agregar" en la app — para que el shortcut se distinga del ícono base.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE_ICON = path.join(ROOT, "public/icons/icon-512.png");
const OUT_DIR = path.join(ROOT, "public/icons");

const VIOLET_FILL = "#6d55f0";
const SIZE = 512;
const BADGE_RADIUS = 108;
const BADGE_CENTER = SIZE - BADGE_RADIUS - 24;

function badgeSvg() {
  const plusArm = 56;
  const plusThickness = 20;
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
      <circle cx="${BADGE_CENTER}" cy="${BADGE_CENTER}" r="${BADGE_RADIUS}" fill="${VIOLET_FILL}" stroke="#0a0a0b" stroke-width="10"/>
      <rect x="${BADGE_CENTER - plusArm / 2}" y="${BADGE_CENTER - plusThickness / 2}" width="${plusArm}" height="${plusThickness}" rx="${plusThickness / 2}" fill="#fff"/>
      <rect x="${BADGE_CENTER - plusThickness / 2}" y="${BADGE_CENTER - plusArm / 2}" width="${plusThickness}" height="${plusArm}" rx="${plusThickness / 2}" fill="#fff"/>
    </svg>
  `);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const composed = await sharp(BASE_ICON)
    .resize(SIZE, SIZE)
    .composite([{ input: badgeSvg(), top: 0, left: 0 }])
    .png()
    .toBuffer();

  for (const size of [96, 192]) {
    await sharp(composed).resize(size, size).png().toFile(path.join(OUT_DIR, `shortcut-gasto-${size}.png`));
  }

  console.log("Generado public/icons/shortcut-gasto-{96,192}.png");
}

main();
