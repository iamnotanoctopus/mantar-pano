/**
 * scripts/themes.mjs → src/styles/themes/<skin>.css
 * Çalıştır: node scripts/build-themes.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { themes } from "./themes.mjs";

const outDir = new URL("../src/styles/themes/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const decl = (tokens, indent) =>
  Object.entries(tokens)
    .map(([k, v]) => `${indent}--${k}: ${v};`)
    .join("\n");

const index = [];
for (const [id, t] of Object.entries(themes)) {
  const css = `/* ${t.label} — üretilmiş dosya, elle düzenleme: scripts/themes.mjs */
:root[data-skin="${id}"] {
${decl(t.light, "  ")}
}
@media (prefers-color-scheme: dark) {
  :root[data-skin="${id}"]:not([data-theme="light"]) {
    color-scheme: dark;
${decl(t.dark, "    ")}
  }
}
:root[data-skin="${id}"][data-theme="dark"] {
  color-scheme: dark;
${decl(t.dark, "  ")}
}
${(t.extra ?? "").trim()}
`;
  writeFileSync(new URL(`${id}.css`, outDir), css);
  index.push(`@import "./${id}.css";`);
}
writeFileSync(new URL("index.css", outDir), `/* Tüm görünüm temaları — üretilmiş dosya */\n${index.join("\n")}\n`);
console.log(`themes: ${Object.keys(themes).join(", ")}`);
