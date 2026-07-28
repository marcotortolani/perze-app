// Genera los splash screens de iOS (`apple-touch-startup-image`) a partir
// del wordmark de perze-brand — node scripts/generate-splash-screens.mjs
//
// Safari no genera un splash a partir del ícono como Android: sin esto,
// instalar la PWA en iOS muestra una pantalla en blanco al abrir hasta que
// carga el JS. Se versionan los PNG resultantes (no se regeneran en cada
// build) porque el logo cambia rara vez — volver a correr este script a
// mano si `perze-brand/assets/wordmark-*.svg` cambia.
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const BRAND = path.join(ROOT, "perze-design/perze-brand/assets");
const OUT_DIR = path.join(ROOT, "public/splash");

// width x height en píxeles de dispositivo (portrait), la tabla estándar de
// `apple-touch-startup-image` — cubre los iPhone/iPad vigentes.
const DEVICES = [
  { name: "iphone-se", width: 750, height: 1334, ratio: 2 },
  { name: "iphone-8-plus", width: 1242, height: 2208, ratio: 3 },
  { name: "iphone-x", width: 1125, height: 2436, ratio: 3 },
  { name: "iphone-xr", width: 828, height: 1792, ratio: 2 },
  { name: "iphone-xs-max", width: 1242, height: 2688, ratio: 3 },
  { name: "iphone-12", width: 1170, height: 2532, ratio: 3 },
  { name: "iphone-12-pro-max", width: 1284, height: 2778, ratio: 3 },
  { name: "iphone-14-pro", width: 1179, height: 2556, ratio: 3 },
  { name: "iphone-14-pro-max", width: 1290, height: 2796, ratio: 3 },
  { name: "ipad-9-7", width: 1536, height: 2048, ratio: 2 },
  { name: "ipad-pro-10-5", width: 1668, height: 2224, ratio: 2 },
  { name: "ipad-pro-11", width: 1668, height: 2388, ratio: 2 },
  { name: "ipad-air-10-9", width: 1640, height: 2360, ratio: 2 },
  { name: "ipad-pro-12-9", width: 2048, height: 2732, ratio: 2 },
];

const THEMES = [
  { name: "dark", background: "#0a0a0b", wordmark: "wordmark-dark.svg" },
  { name: "light", background: "#fafaf9", wordmark: "wordmark-light.svg" },
];

async function renderWordmarkPng(svgPath, targetWidth) {
  const svg = readFileSync(svgPath, "utf8");
  const viewBoxMatch = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const [, vbW, vbH] = viewBoxMatch;
  const targetHeight = Math.round((targetWidth * Number(vbH)) / Number(vbW));
  return sharp(Buffer.from(svg)).resize(targetWidth, targetHeight).png().toBuffer();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const theme of THEMES) {
    const wordmarkTargetBase = 320; // ancho del logo a densidad 1x, escala según el dispositivo
    for (const device of DEVICES) {
      const wordmarkWidth = Math.round(wordmarkTargetBase * (device.width / 750));
      const wordmarkPng = await renderWordmarkPng(path.join(BRAND, theme.wordmark), wordmarkWidth);
      const wordmarkMeta = await sharp(wordmarkPng).metadata();

      const canvas = sharp({
        create: {
          width: device.width,
          height: device.height,
          channels: 4,
          background: theme.background,
        },
      });

      const left = Math.round((device.width - wordmarkMeta.width) / 2);
      const top = Math.round((device.height - wordmarkMeta.height) / 2);

      const outPath = path.join(OUT_DIR, `${device.name}-${theme.name}.png`);
      await canvas.composite([{ input: wordmarkPng, left, top }]).png().toFile(outPath);
      console.log(outPath);
    }
  }
}

main();
