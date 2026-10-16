/**
 * README ekran görüntüleri: 4 tema × masaüstü/telefon + Bugün odağı ve ayar çekmecesi.
 *   npm run build:static && npm run build:screenshots   →  docs/screenshots/*.jpg
 * Statik derlemeyi (dist/, local-first demo verisi) Vite preview ile açar ve Playwright (Chromium)
 * ile çeker. Tarayıcı yolu PLAYWRIGHT_BROWSERS_PATH ile verilebilir (playwright-core indirme yapmaz).
 */
import { mkdirSync, readFileSync } from "node:fs";
import { preview } from "vite";
import { chromium } from "playwright-core";

const tokens = JSON.parse(readFileSync(new URL("../design/tokens.json", import.meta.url), "utf8"));
const themes = tokens.color.themes.map((t) => t.id);
const outDir = new URL("../docs/screenshots/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const out = (name) => new URL(name, outDir).pathname;

const server = await preview({ configFile: new URL("../vite.config.ts", import.meta.url).pathname, preview: { port: 4399, strictPort: true, open: false } });
const url = "http://localhost:4399/";
const browser = await chromium.launch();

async function shoot(name, { theme, width, height, scale = 1, mobile = false, steps = [] }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  await ctx.addInitScript((t) => {
    if (sessionStorage.getItem("shot")) return;
    sessionStorage.setItem("shot", "1");
    sessionStorage.setItem("mp.nudged", "1"); // açılış dürtmesi ve bildirimi görüntüye girmesin
    localStorage.clear();
    localStorage.setItem("mp.theme", t);
    localStorage.setItem("mp.prefs", JSON.stringify({ v: 2, theme: t }));
  }, theme);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector(".card");
  for (const s of steps) {
    if (s.key) await page.keyboard.press(s.key);
    if (s.click) await page.click(s.click);
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out(`${name}.jpg`), type: "jpeg", quality: 84 });
  await ctx.close();
  console.log(`  docs/screenshots/${name}.jpg`);
}

try {
  for (const theme of themes) {
    await shoot(`${theme}-desktop`, { theme, width: 1440, height: 900 });
    await shoot(`${theme}-phone`, { theme, width: 390, height: 844, scale: 2, mobile: true });
  }
  await shoot("odak-bugun", { theme: "amanita", width: 1440, height: 900, steps: [{ key: "2" }] });
  await shoot("odak-hafta", { theme: "classic-cork", width: 1440, height: 900, steps: [{ key: "3" }] });
  await shoot("ayarlar", { theme: "amanita", width: 1440, height: 900, steps: [{ click: ".topbar__gear" }] });
  await shoot("suz-telefon", { theme: "midnight-wood", width: 390, height: 844, scale: 2, mobile: true, steps: [{ click: ".capsule__btn--filter" }] });
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
