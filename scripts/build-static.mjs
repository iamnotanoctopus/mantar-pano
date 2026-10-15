/**
 * Statik (local-first) derleme — GitHub Pages / Netlify / Vercel gibi dosya sunucuları için.
 *   node scripts/build-static.mjs            → dist/  (kök yolda yayın)
 *   BASE_PATH=/mantar-pano/ node scripts/build-static.mjs   → alt yolda yayın (GitHub Pages proje sitesi)
 * Platformdan bağımsızdır (Windows'ta da çalışır); ortam değişkenini kendisi ayarlar.
 */
import { build } from "vite";

process.env.VITE_API_MODE = "local";
await build({ configFile: new URL("../vite.config.ts", import.meta.url).pathname });
console.log(`statik derleme hazır: dist/ (base: ${process.env.BASE_PATH ?? "/"}, veri: local-first)`);
