/**
 * v1 → v2 tercih göçü testi. Çalıştır: `npm test`
 */
import assert from "node:assert/strict";
import { DEFAULT_PREFS, migratePrefs } from "../state/prefsModel.ts";
import { resolveTheme } from "../lib/themes.ts";

// Kayıt yok: varsayılan Amanita; claude.ai görüntüleyicisi koyuysa Midnight Wood
assert.equal(migratePrefs(null).theme, "amanita");
assert.equal(migratePrefs(null, "dark").theme, "midnight-wood");
assert.deepEqual(migratePrefs(null), DEFAULT_PREFS);

// v1: skin → theme (mantar ve diğerleri → classic-cork), view → focus, yeni alanlar varsayılanla
const v1 = migratePrefs({ theme: "system", skin: "mantar", view: "today", showNotes: false, sound: false, nudgeOnOverdue: true });
assert.equal(v1.v, 2);
assert.equal(v1.theme, "classic-cork");
assert.equal(v1.focus, "today");
assert.equal(v1.showNotes, false);
assert.equal(v1.sound, false);
assert.equal(v1.texture, "auto");
assert.equal(v1.pinStyle, "auto");
assert.equal(v1.showDone, false);
assert.deepEqual(v1.filters, { areas: [], priorities: [] });
assert.ok(!("view" in v1) && !("skin" in v1), "view ve skin kalkmalı");
for (const skin of ["msn", "kumsal", "cyberpunk"]) assert.equal(migratePrefs({ theme: "light", skin }).theme, "classic-cork");
assert.equal(migratePrefs({ theme: "dark", skin: "cyberpunk" }).theme, "midnight-wood");
assert.equal(migratePrefs({ view: "calendar" }).focus, "week");
assert.equal(migratePrefs({ view: "all" }).focus, "areas");

// v2: doğrulama, bozuk değerler varsayılana döner
const v2 = migratePrefs({ v: 2, theme: "cupertino-glass", texture: "cam", pinStyle: "glass", focus: "week", filters: { areas: ["İş", 3], priorities: "x" }, showDone: true });
assert.equal(v2.theme, "cupertino-glass");
assert.equal(v2.texture, "cam");
assert.equal(v2.pinStyle, "glass");
assert.equal(v2.focus, "week");
assert.deepEqual(v2.filters, { areas: ["İş"], priorities: [] });
assert.equal(v2.showDone, true);
const broken = migratePrefs({ v: 2, theme: "msn", texture: "neon", pinStyle: 7, focus: "calendar" });
assert.equal(broken.theme, "amanita");
assert.equal(broken.texture, "auto");
assert.equal(broken.pinStyle, "auto");
assert.equal(broken.focus, "areas");
assert.equal(migratePrefs({ v: 2, theme: "system" }).theme, "system");

// "system" teması işletim sistemine göre çözülür
assert.equal(resolveTheme("system", false), "amanita");
assert.equal(resolveTheme("system", true), "midnight-wood");
assert.equal(resolveTheme("classic-cork", true), "classic-cork");

console.log("✓ tercihler: v1 → v2 göçü, doğrulama ve sistem teması doğru");
