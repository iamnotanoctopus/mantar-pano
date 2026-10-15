import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Geliştirmede /api istekleri Hono sunucusuna (8787) yönlendirilir.
// Üretimde sunucu dist/ klasörünü kendisi servis eder, proxy gerekmez.
// Statik yayın (GitHub Pages) için BASE_PATH=/repo-adi/ ve VITE_API_MODE=local verilir.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
