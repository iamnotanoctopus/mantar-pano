/**
 * design/tokens.json → src/styles/themes/*.css
 *
 * Tasarım sisteminin (Mantar Pano v2) tek kaynağı design/tokens.json'dur. Bu betik:
 *   - her tema için `:root[data-theme="<id>"]` bloğu yazar (renk + gölge + yapı token'ları);
 *     ilk tema (amanita) aynı zamanda `:root` varsayılanıdır,
 *   - index.css'e temalar arası ortak token'ları (boşluk, köşe, yazı, fizik) ve tema dosyalarını koyar.
 * Token adları olduğu gibi CSS değişkeni olur: `kart-yuzey` → `--kart-yuzey`.
 *   Çalıştır: npm run build:themes
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const tokens = JSON.parse(readFileSync(new URL("../design/tokens.json", import.meta.url), "utf8"));
const outDir = new URL("../src/styles/themes/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const themes = tokens.color.themes;
const first = themes[0].id;
const perTheme = [...tokens.color.tokens, ...(tokens.shadow?.tokens ?? []), ...(tokens.yapi?.tokens ?? [])];
const valueOf = (tok, id) => (typeof tok.value === "string" ? tok.value : (tok.value[id] ?? tok.value[first]));
const header = (what) => `/* ${what} — design/tokens.json'dan üretildi (npm run build:themes). Elle düzenleme. */`;

for (const { id, name } of themes) {
  const lines = perTheme.map((tok) =>
    tok.name === "renk-semasi" ? `  color-scheme: ${valueOf(tok, id)};` : `  --${tok.name}: ${valueOf(tok, id)};`,
  );
  const selector = id === first ? `:root,\n:root[data-theme="${id}"]` : `:root[data-theme="${id}"]`;
  writeFileSync(new URL(`${id}.css`, outDir), `${header(name)}\n${selector} {\n${lines.join("\n")}\n}\n`);
}

/* Ortak token'lar: boşluk, köşe, yazı aileleri ve stilleri, fizik */
const shared = [];
for (const t of tokens.spacing?.tokens ?? []) shared.push(`  --${t.name}: ${t.value};`);
for (const t of tokens.radius?.tokens ?? []) shared.push(`  --${t.name}: ${t.value};`);
for (const [k, v] of Object.entries(tokens.type?.families ?? {})) shared.push(`  --aile-${k}: ${v};`);
for (const g of tokens.type?.groups ?? []) {
  for (const s of g.styles) {
    shared.push(`  --yazi-${s.name}: ${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--aile-${g.family});`);
    if (s.opticalSize) shared.push(`  --yazi-${s.name}-opsz: ${s.opticalSize};`);
    if (s.letterSpacing) shared.push(`  --yazi-${s.name}-aralik: ${s.letterSpacing};`);
  }
}
for (const t of tokens.fizik?.tokens ?? []) shared.push(`  --${t.name}: ${t.value};`);

const index = `${header("Mantar Pano v2 temaları")}
${themes.map(({ id }) => `@import "./${id}.css";`).join("\n")}

:root {
${shared.join("\n")}
}
`;
writeFileSync(new URL("index.css", outDir), index);
console.log(`temalar: ${themes.map((t) => t.id).join(", ")} · ${perTheme.length} tema token'ı · ${shared.length} ortak token`);
