/**
 * Pano odakları (Alanlar · Bugün · Hafta) ve süzgeç testi. Çalıştır: `npm test`
 */
import assert from "node:assert/strict";
import { DEFAULT_SCHEMA, type Task } from "../../shared/types.ts";
import { applyFilters, buildLayout, byArea, byToday, byWeek, dropPatch } from "../board/layouts.ts";
import { areaColor, slug } from "../lib/format.ts";

const h = { today: "2026-10-16", weekAhead: "2026-10-23" }; // Cuma
let n = 0;
const task = (p: Partial<Task>): Task => ({
  id: `t${++n}`,
  title: p.title ?? `Kart ${n}`,
  area: "İş",
  status: "Yapılacak",
  priority: "Orta",
  date: null,
  dateEnd: null,
  duration: null,
  note: "",
  dayLabel: null,
  url: null,
  createdTime: "2026-10-01T00:00:00Z",
  lastEditedTime: "2026-10-01T00:00:00Z",
  ...p,
});

const tasks: Task[] = [
  task({ title: "Geciken", date: "2026-10-14", priority: "Düşük", duration: 30 }),
  task({ title: "Bugün yüksek", date: "2026-10-16", priority: "Yüksek", area: "Okul", duration: 45 }),
  task({ title: "Bugün düşük", date: "2026-10-16", priority: "Düşük", area: "Kişisel" }),
  task({ title: "Bugün bitti", date: "2026-10-16", status: "Bitti" }),
  task({ title: "Yarın", date: "2026-10-17", area: "Görünürlük" }),
  task({ title: "Tarihsiz", date: null, area: "Okul", note: "kitap notu" }),
  task({ title: "Uzak", date: "2026-11-20" }),
  task({ title: "Ajan işi", date: "2026-10-18", area: "Ajan" }),
];

/* Alanlar: v1 pano kuralı (≤ +7 gün ya da tarihsiz), bitenler gizli, bilinmeyen alan → Alansız */
const areas = byArea(applyFilters(tasks, { filters: { areas: [], priorities: [] }, showDone: false, query: "" }), DEFAULT_SCHEMA, { horizon: true, h });
assert.deepEqual(areas.map((l) => l.title), ["İş", "Görünürlük", "Okul", "Kişisel", "Alansız"]);
assert.deepEqual(areas[0].tasks.map((t) => t.title), ["Geciken"], "uzak tarihli kart Alanlar'da görünmez");
assert.deepEqual(areas[2].tasks.map((t) => t.title), ["Bugün yüksek", "Tarihsiz"], "tarih ↑, tarihsiz en sonda");
assert.deepEqual(areas[4].tasks.map((t) => t.title), ["Ajan işi"]);
assert.deepEqual(areas[0].drop, { area: "İş" });
assert.equal(areas[2].totalMinutes, 45);

/* Bugün: Gecikenler · Bugün · Yarın; öncelik sırası; bitenler yalnızca "Bitmişleri göster" ile ve sonda */
const today = byToday(applyFilters(tasks, { filters: { areas: [], priorities: [] }, showDone: true, query: "" }), DEFAULT_SCHEMA, h);
assert.deepEqual(today.map((l) => l.title), ["Gecikenler", "Bugün", "Yarın"]);
assert.deepEqual(today[0].tasks.map((t) => t.title), ["Geciken"]);
assert.deepEqual(today[1].tasks.map((t) => t.title), ["Bugün yüksek", "Bugün düşük", "Bugün bitti"]);
assert.deepEqual(today[2].tasks.map((t) => t.title), ["Yarın"]);
assert.equal(today[0].drop, null, "Gecikenler'e kart bırakılamaz");
assert.deepEqual(today[1].drop, { date: "2026-10-16" });
assert.deepEqual(today[2].add, { date: "2026-10-17" });

/* Hafta: Pzt…Paz + Tarihsiz; gün şeridine bırakmak tarihi değiştirir */
const week = byWeek(tasks.filter((t) => t.status !== "Bitti"), DEFAULT_SCHEMA, "2026-10-14", h);
assert.equal(week.length, 8);
assert.equal(week[0].id, "day:2026-10-12", "hafta pazartesiden başlar");
assert.equal(week[4].tone, "today");
assert.deepEqual(week[4].tasks.map((t) => t.title), ["Bugün yüksek", "Bugün düşük"]);
assert.deepEqual(week[6].tasks.map((t) => t.title), ["Ajan işi"]);
assert.equal(week[7].title, "Tarihsiz");
assert.deepEqual(week[7].tasks.map((t) => t.title), ["Tarihsiz"]);
assert.deepEqual(week[7].drop, { date: null, dateEnd: null });
assert.deepEqual(week[7].add, { date: null }, "Tarihsiz'deki ayrıntılı taslak odak tarihini devralmaz");
assert.deepEqual(week[3].drop, { date: "2026-10-15" });

/* Süzgeç: alan ve öncelik çoklu seçim, arama */
const f = applyFilters(tasks, { filters: { areas: ["Okul", "Kişisel"], priorities: ["Yüksek"] }, showDone: false, query: "" });
assert.deepEqual(f.map((t) => t.title), ["Bugün yüksek"]);
assert.deepEqual(applyFilters(tasks, { filters: { areas: [], priorities: [] }, showDone: false, query: "kitap" }).map((t) => t.title), ["Tarihsiz"], "arama notta da bakar");

/* buildLayout: odak dışında sayısı; arama yapılırken Alanlar'da ufuk kalkar */
const base = { tasks, schema: DEFAULT_SCHEMA, filters: { areas: [], priorities: [] }, showDone: false, query: "", weekStart: "2026-10-12", h };
const open = tasks.filter((t) => t.status !== "Bitti").length; // 7
assert.equal(buildLayout({ ...base, focus: "areas" }).hidden, 1, "yalnızca uzak kart dışarıda");
assert.equal(buildLayout({ ...base, focus: "today" }).shown, 4);
assert.equal(buildLayout({ ...base, focus: "today" }).hidden, open - 4);
assert.equal(buildLayout({ ...base, focus: "areas", query: "uzak" }).shown, 1, "arama uzak kartı bulur");
assert.equal(buildLayout({ ...base, focus: "week" }).shown, 6);

/* Gece yarısı: "bugün" dışarıdan verilir; ertesi gün Bugün şeridi ve hızlı ekleme yeni tarihi kullanır */
const nextDay = { today: "2026-10-17", weekAhead: "2026-10-24" };
const todayLane = buildLayout({ ...base, focus: "today", h: nextDay }).lanes[1];
assert.deepEqual(todayLane.add, { date: "2026-10-17" });
assert.deepEqual(todayLane.tasks.map((t) => t.title), ["Yarın"]);

/* Bırakma: değişmeyen alan atılır; çok günlü kartın süresi korunur; Tarihsiz ikisini de siler */
const span = task({ title: "Konferans", date: "2026-10-15", dateEnd: "2026-10-17" });
assert.deepEqual(dropPatch(span, { date: "2026-10-12" }), { date: "2026-10-12", dateEnd: "2026-10-14" }, "3 gün sürer, geriye");
assert.deepEqual(dropPatch(span, { date: "2026-10-18" }), { date: "2026-10-18", dateEnd: "2026-10-20" }, "3 gün sürer, ileriye");
assert.deepEqual(dropPatch(span, { date: null, dateEnd: null }), { date: null, dateEnd: null });
assert.equal(dropPatch(span, { date: "2026-10-15" }), null, "aynı gün → değişiklik yok");
assert.equal(dropPatch(task({ date: null }), { date: null, dateEnd: null }), null, "zaten tarihsiz");
assert.equal(dropPatch(task({ area: "Okul" }), { area: "Okul" }), null);
assert.deepEqual(dropPatch(task({ area: "Okul", date: "2026-10-16" }), { area: "İş" }), { area: "İş" });
assert.deepEqual(dropPatch(task({ date: "2026-10-16" }), { date: "2026-10-17" }), { date: "2026-10-17" }, "tek günlük kartın bitişi yok");

/* Alan renkleri: tasarımın dört alanı token'dan, diğerleri Notion renginden */
assert.equal(slug("Görünürlük"), "gorunurluk");
assert.equal(slug("İş"), "is");
assert.equal(areaColor("Kişisel", "pink"), "var(--alan-kisisel)");
assert.equal(areaColor("Ajan", "purple"), "var(--c-purple)");

console.log("✓ pano: Alanlar · Bugün · Hafta odakları, süzgeç, odak dışı sayısı ve bırakma kuralı doğru");
