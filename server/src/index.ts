import "dotenv/config";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import type { TaskInput, TaskPatch } from "../../shared/types.ts";
import { HttpError, type TaskRepo } from "./repo.ts";
import { DemoRepo } from "./demoRepo.ts";
import { NotionRepo } from "./notionRepo.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT ?? 8787);
const IS_PROD = process.env.NODE_ENV === "production";

/* ------------------------------ Depo seçimi ------------------------------ */

function createRepo(): { repo: TaskRepo; mode: "notion" | "demo" } {
  const token = (process.env.NOTION_TOKEN ?? "").trim();
  const forced = (process.env.DATA_MODE ?? "auto").toLowerCase();
  if (forced === "demo" || !token) {
    return { repo: new DemoRepo(), mode: "demo" };
  }
  return {
    repo: new NotionRepo({
      token,
      dataSourceId: process.env.NOTION_DATA_SOURCE_ID?.trim(),
      databaseId: process.env.NOTION_DATABASE_ID?.trim(),
      version: process.env.NOTION_VERSION?.trim() || undefined,
    }),
    mode: "notion",
  };
}

const { repo, mode } = createRepo();

/* -------------------------------- Uygulama ------------------------------- */

const app = new Hono();

if (!IS_PROD) {
  app.use("*", logger());
  app.use("/api/*", cors());
}

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
  console.error(err);
  return c.json({ error: err instanceof Error ? err.message : "Beklenmeyen hata" }, 500);
});

/* İsteğe bağlı basit koruma: APP_PASSWORD tanımlıysa her /api isteği x-app-key başlığı ister. */
const APP_PASSWORD = (process.env.APP_PASSWORD ?? "").trim();

app.get("/api/health", (c) => c.json({ ok: true, mode, protected: Boolean(APP_PASSWORD) }));

app.use("/api/*", async (c, next) => {
  if (!APP_PASSWORD || c.req.path === "/api/health") return next();
  const key = c.req.header("x-app-key") ?? "";
  if (key !== APP_PASSWORD) return c.json({ error: "Şifre gerekli.", code: "auth" }, 401);
  await next();
});

app.get("/api/meta", async (c) => c.json(await repo.meta()));

app.get("/api/tasks", async (c) => {
  const fresh = c.req.query("fresh") === "1";
  const tasks = await repo.list({ fresh });
  return c.json({ tasks, syncedAt: new Date().toISOString() });
});

app.post("/api/tasks", async (c) => {
  const body = (await c.req.json().catch(() => null)) as TaskInput | null;
  if (!body) throw new HttpError(400, "Geçersiz istek gövdesi.");
  const task = await repo.create(body);
  return c.json(task, 201);
});

app.patch("/api/tasks/:id", async (c) => {
  const body = (await c.req.json().catch(() => null)) as TaskPatch | null;
  if (!body) throw new HttpError(400, "Geçersiz istek gövdesi.");
  const task = await repo.update(c.req.param("id"), body);
  return c.json(task);
});

app.delete("/api/tasks/:id", async (c) => {
  await repo.archive(c.req.param("id"));
  return c.body(null, 204);
});

/* ------------------------- Üretimde statik dosyalar ------------------------ */

if (IS_PROD) {
  app.use("/*", serveStatic({ root: path.relative(process.cwd(), DIST) || "dist" }));
  // SPA: bilinmeyen yolları index.html'e düşür
  app.get("*", async (c) => {
    const html = await fs.readFile(path.join(DIST, "index.html"), "utf8").catch(() => null);
    if (!html) return c.text("dist/ bulunamadı — önce `npm run build` çalıştır.", 500);
    return c.html(html);
  });
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  const where = mode === "notion" ? "Notion (canlı senkron)" : "demo (server/data/tasks.json)";
  console.log(`📌 Mantar Pano API  http://localhost:${info.port}  ·  veri: ${where}`);
  if (IS_PROD) console.log(`   Uygulama: http://localhost:${info.port}`);
});
