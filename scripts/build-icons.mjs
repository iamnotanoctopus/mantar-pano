/**
 * Uygulama ikonları: Amanita raptiye logosu → public/pin.svg, pin-180.png, pin-512.png
 * Geometri src/lib/brand.ts'ten, renkler design/tokens.json'daki varsayılan temadan (amanita) gelir.
 * PNG'ler Playwright (Chromium) ile rasterize edilir.
 *   Çalıştır: npm run build:icons
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { logoSvg } from "../src/lib/brand.ts";

const tokens = JSON.parse(readFileSync(new URL("../design/tokens.json", import.meta.url), "utf8"));
const theme = tokens.color.themes[0].id;
const tok = (name) => tokens.color.tokens.find((t) => t.name === name).value[theme];
const colors = { sapka: tok("raptiye-sapka"), benek: tok("raptiye-benek"), igne: tok("raptiye-igne"), kenar: tok("kart-kenar") };
const background = tok("zemin");

const out = (name) => new URL(`../public/${name}`, import.meta.url);

// Sekme simgesi (SVG): küçük boyutta okunsun diye kenar boşluğu dar
const favicon = logoSvg(colors, { background, size: 64, padding: 0.08 });
writeFileSync(out("pin.svg"), `${favicon}\n`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // 180: Apple dokunma simgesi · 512: "maskable" — logo %80'lik güvenli bölgede kalsın
  for (const [size, padding] of [
    [180, 0.12],
    [512, 0.16],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${logoSvg(colors, { background, size, padding })}</body></html>`);
    const png = await page.locator("svg").screenshot({ omitBackground: true });
    writeFileSync(out(`pin-${size}.png`), png);
  }
} finally {
  await browser.close();
}
console.log(`ikonlar: public/pin.svg, pin-180.png, pin-512.png (tema: ${theme})`);
