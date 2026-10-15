/**
 * NotionRepo için sahte-fetch testi: Notion'a gönderilen istek gövdelerini ve
 * dönen sayfaların Task'a eşlenmesini doğrular. Çalıştır: `npm test`
 */
import assert from "node:assert/strict";
import { NotionRepo } from "../src/notionRepo.ts";

type Call = { url: string; init?: RequestInit };
const calls: Call[] = [];

const page = {
  object: "page",
  id: "3fad90c7-3556-81ba-946c-ceea25c63d86",
  url: "https://www.notion.so/3fad90c7355681ba946cceea25c63d86",
  created_time: "2026-10-15T13:36:40.000Z",
  last_edited_time: "2026-10-15T13:36:40.000Z",
  archived: false,
  in_trash: false,
  properties: {
    Görev: { type: "title", title: [{ plain_text: "Konumlanma " }, { plain_text: "cümlesi" }] },
    Alan: { type: "select", select: { name: "Görünürlük", color: "orange" } },
    Durum: { type: "status", status: { name: "Yapılacak", color: "default" } },
    Öncelik: { type: "select", select: { name: "Yüksek", color: "red" } },
    Tarih: { type: "date", date: { start: "2026-10-16", end: null, time_zone: null } },
    "Süre (dk)": { type: "number", number: 30 },
    Not: { type: "rich_text", rich_text: [{ plain_text: "Tek cümle." }] },
    Gün: { type: "formula", formula: { type: "string", string: "Yarın" } },
  },
};

const dataSource = {
  object: "data_source",
  id: "0afa34c2-9951-4a1b-9306-d2958d720bdf",
  title: [{ plain_text: "Görevlerim" }],
  parent: { type: "database_id", database_id: "162646de-a4a6-4bd1-80d1-64311a3406f2" },
  properties: {
    Alan: {
      type: "select",
      select: {
        options: [
          { id: "a", name: "İş", color: "blue" },
          { id: "b", name: "Görünürlük", color: "orange" },
        ],
      },
    },
    Durum: {
      type: "status",
      status: {
        options: [
          { id: "s1", name: "Yapılacak", color: "default" },
          { id: "s2", name: "Sürüyor", color: "blue" },
          { id: "s3", name: "Bitti", color: "green" },
        ],
        groups: [
          { id: "g1", name: "To-do", color: "default", option_ids: ["s1"] },
          { id: "g2", name: "In progress", color: "blue", option_ids: ["s2"] },
          { id: "g3", name: "Complete", color: "green", option_ids: ["s3"] },
        ],
      },
    },
    Öncelik: { type: "select", select: { options: [{ id: "p1", name: "Yüksek", color: "red" }, { id: "p2", name: "Orta", color: "yellow" }] } },
  },
};

globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const u = String(url);
  calls.push({ url: u, init });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (u.endsWith("/data_sources/0afa34c2-9951-4a1b-9306-d2958d720bdf") && (!init?.method || init.method === "GET")) return json(dataSource);
  if (u.endsWith("/data_sources/0afa34c2-9951-4a1b-9306-d2958d720bdf/query")) return json({ results: [page], next_cursor: null, has_more: false });
  if (u.endsWith("/pages") && init?.method === "POST") return json({ ...page, id: "new-id" });
  if (u.includes("/pages/") && init?.method === "PATCH") return json({ ...page, properties: { ...page.properties, Durum: { type: "status", status: { name: "Bitti" } } } });
  return json({ message: `beklenmeyen istek ${u}` }, 404);
}) as typeof fetch;

const repo = new NotionRepo({ token: "secret_test", dataSourceId: "0afa34c2-9951-4a1b-9306-d2958d720bdf" });

// meta / şema
const meta = await repo.meta();
assert.equal(meta.mode, "notion");
assert.equal(meta.dataSourceTitle, "Görevlerim");
assert.equal(meta.notionUrl, "https://www.notion.so/162646dea4a64bd180d164311a3406f2");
assert.deepEqual(
  meta.schema.statuses.map((s) => s.group),
  ["to_do", "in_progress", "complete"],
);
assert.equal(calls[0].init?.headers && (calls[0].init.headers as Record<string, string>)["Notion-Version"], "2025-09-03");
assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer secret_test");

// list → eşleme
const tasks = await repo.list();
assert.equal(tasks.length, 1);
assert.deepEqual(
  { ...tasks[0] },
  {
    id: "3fad90c7355681ba946cceea25c63d86",
    title: "Konumlanma cümlesi",
    area: "Görünürlük",
    status: "Yapılacak",
    priority: "Yüksek",
    date: "2026-10-16",
    dateEnd: null,
    duration: 30,
    note: "Tek cümle.",
    dayLabel: "Yarın",
    url: "https://www.notion.so/3fad90c7355681ba946cceea25c63d86",
    createdTime: "2026-10-15T13:36:40.000Z",
    lastEditedTime: "2026-10-15T13:36:40.000Z",
  },
);
const q = calls.find((c) => c.url.endsWith("/query"))!;
assert.deepEqual(JSON.parse(String(q.init?.body)), { page_size: 100, sorts: [{ property: "Tarih", direction: "ascending" }] });

// create → gövde
await repo.create({ title: "Yeni", area: "İş", priority: "Orta", date: "2026-10-20", duration: 45, note: "n" });
const c = calls.find((x) => x.url.endsWith("/pages") && x.init?.method === "POST")!;
assert.deepEqual(JSON.parse(String(c.init?.body)), {
  parent: { type: "data_source_id", data_source_id: "0afa34c2-9951-4a1b-9306-d2958d720bdf" },
  properties: {
    Durum: { status: { name: "Yapılacak" } },
    Görev: { title: [{ type: "text", text: { content: "Yeni" } }] },
    Alan: { select: { name: "İş" } },
    Öncelik: { select: { name: "Orta" } },
    Tarih: { date: { start: "2026-10-20", end: null } },
    "Süre (dk)": { number: 45 },
    Not: { rich_text: [{ type: "text", text: { content: "n" } }] },
  },
});

// bilinmeyen seçenek reddedilir (Notion'da yeni seçenek oluşmasın)
await assert.rejects(repo.create({ title: "x", area: "Yok" }), /Bilinmeyen alan/);

// update → yalnızca değişen alanlar, tarih temizleme
await repo.update("3fad90c7355681ba946cceea25c63d86", { status: "Bitti", date: null, priority: null, note: "" });
const u = calls.find((x) => x.init?.method === "PATCH")!;
assert.deepEqual(JSON.parse(String(u.init?.body)), {
  properties: {
    Durum: { status: { name: "Bitti" } },
    Öncelik: { select: null },
    Tarih: { date: null },
    Not: { rich_text: [] },
  },
});
const after = await repo.list();
assert.equal(after[0].status, "Bitti", "önbellek güncellenmeli");

// archive
await repo.archive("3fad90c7355681ba946cceea25c63d86");
const a = calls.filter((x) => x.init?.method === "PATCH").at(-1)!;
assert.deepEqual(JSON.parse(String(a.init?.body)), { archived: true });
assert.ok(!(await repo.list()).some((t) => t.id === "3fad90c7355681ba946cceea25c63d86"), "arşivlenen kart önbellekten düşmeli");

console.log("✓ notionRepo: şema, eşleme, oluşturma, güncelleme, arşivleme doğru");
