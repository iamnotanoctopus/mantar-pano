/**
 * dist-artifact/index.html → artifact/mantar-pano.html
 *
 * claude.ai Artifact sayfası yayımlanırken kendi <html>/<head>/<body> iskeletine sarılır;
 * bu yüzden Vite'ın ürettiği tam belgeden yalnızca <style> ve <script> içeriklerini alıp
 * başına <title>, Google Fonts bağlantısı ve kök öğeyi koyarız.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = readFileSync(new URL("../dist-artifact/index.html", import.meta.url), "utf8");

const styles = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
const scripts = [...src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
if (!scripts.length) throw new Error("dist-artifact/index.html içinde satır içi script bulunamadı — vite-plugin-singlefile çalıştı mı?");
if (/<script[^>]+src=/.test(src)) throw new Error("Harici script kaldı; tek dosya derlemesi tamamlanmamış.");

// v2: başlıklar Fraunces (opsz ekseniyle), arayüz metni sistem yazı tipi → Google Fonts'tan yalnızca Fraunces
const fonts = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&display=swap";

const mode = process.env.ARTIFACT_MODE === "local" ? "local" : "mcp";
const outName = mode === "local" ? "mantar-pano-demo.html" : "mantar-pano.html";
const page = `<title>${mode === "local" ? "Mantar Pano Demo" : "Mantar Pano"}</title>
<link rel="stylesheet" href="${fonts}">
<style>
${styles.trim()}
</style>
<div id="root"></div>
${scripts.map((s) => `<script type="module">\n${s.trim()}\n</script>`).join("\n")}
`;

mkdirSync(new URL("../artifact/", import.meta.url), { recursive: true });
writeFileSync(new URL(`../artifact/${outName}`, import.meta.url), page);
console.log(`artifact/${outName} yazıldı (${(page.length / 1024).toFixed(0)} KB, veri: ${mode})`);
