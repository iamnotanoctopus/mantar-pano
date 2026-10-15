import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath, URL } from "node:url";

/**
 * claude.ai Artifact derlemesi: tek dosya, sunucusuz (VITE_API_MODE=mcp).
 * Yazı tipleri Google Fonts'tan yüklenir (Artifact CSP'sinin izin verdiği tek yazı tipi kaynağı),
 * bu yüzden @fontsource paketleri boş bir CSS'e yönlendirilir.
 *   npm run build:artifact  →  artifact/mantar-pano.html
 */
export default defineConfig({
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  define: {
    "import.meta.env.VITE_API_MODE": JSON.stringify("mcp"),
  },
  resolve: {
    alias: [
      { find: /^@fontsource(-variable)?\/.*/, replacement: fileURLToPath(new URL("./src/styles/empty.css", import.meta.url)) },
      { find: "@shared", replacement: fileURLToPath(new URL("./shared", import.meta.url)) },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
  },
  build: {
    outDir: "dist-artifact",
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: { polyfill: false },
  },
});
