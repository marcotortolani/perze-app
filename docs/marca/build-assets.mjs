// Genera todos los PNG a partir de los SVG maestros. node build-assets.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const CHROME = process.env.CHROME_PATH || undefined;
const jobs = [
  ['assets/app-icon-any.svg',      512, 'assets/icon-512.png'],
  ['assets/app-icon-any.svg',      192, 'assets/icon-192.png'],
  ['assets/app-icon-any.svg',      180, 'assets/apple-icon.png'],
  ['assets/app-icon-maskable.svg', 512, 'assets/icon-maskable-512.png'],
  ['assets/app-icon-maskable.svg', 192, 'assets/icon-maskable-192.png'],
  ['assets/app-icon-mono.svg',     512, 'assets/icon-mono-512.png'],
  ['assets/icon.svg',               48, 'assets/favicon-48.png'],
  ['assets/icon.svg',               32, 'assets/favicon-32.png'],
  ['assets/icon.svg',               16, 'assets/favicon-16.png'],
];
const b = await chromium.launch(CHROME ? {executablePath:CHROME} : {});
for (const [src, size, out] of jobs) {
  const p = await b.newPage({viewport:{width:size,height:size}});
  const svg = fs.readFileSync(src,'utf8');
  await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await p.screenshot({path:out, omitBackground:true});
  await p.close();
  console.log(out);
}
// OG 1200x630 y 1200x1200
const lock = fs.readFileSync('assets/wordmark-dark.svg','utf8');
for (const [w,h,out] of [[1200,630,'assets/opengraph-image.png'],[1200,1200,'assets/og-square.png']]) {
  const p = await b.newPage({viewport:{width:w,height:h}});
  await p.setContent(`<style>html,body{margin:0;height:100%;background:#0A0A0B;display:flex;align-items:center;justify-content:center}svg{width:${Math.round(w*0.46)}px;height:auto}</style>${lock}`);
  await p.screenshot({path:out});
  await p.close();
  console.log(out);
}
await b.close();
