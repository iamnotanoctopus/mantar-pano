# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Mantar Pano: Notion görev veritabanını mantar pano olarak gösteren React 19 + Vite 7 + TypeScript uygulaması (Hono sunucusu, TanStack Query, @dnd-kit/core, motion 13 `motion/react`). Arayüz metinleri, kod yorumları, commit mesajları ve belgeler Türkçedir.

## Komutlar

```bash
npm run dev               # Hono API (8787, tsx watch) + Vite (5173); /api proxy'lenir
npm run typecheck         # istemci + server/tsconfig.json
npm test                  # üç test betiği sırayla (çerçeve yok: tsx + node:assert)
npx tsx src/test/layouts.test.ts       # tek test: pano odakları, süzgeç, dropPatch
npx tsx src/test/prefs.test.ts         # tek test: tercih göçü (v1 → v2)
npx tsx server/test/notionRepo.test.ts # tek test: Notion eşleme (sahte fetch)
npm run build:static      # local-first dist/ (VITE_API_MODE=local); BASE_PATH=/mantar-pano/ ile alt yol
npm run build:artifact    # claude.ai artifact (tek dosya, mcp modu) → artifact/ (gitignore'da)
npm run build:artifact:demo   # aynı, local modda
npm run build:themes      # design/tokens.json → src/styles/themes/*.css
npm run build:icons       # public/pin.svg, pin-180.png, pin-512.png (playwright-core)
npm run build:screenshots # build:static sonrası → docs/screenshots/*.jpg (playwright-core, vite preview :4399)
```

Bir değişikliği bitmiş saymadan önce: `npm run typecheck && npm test && npm run build:static`. CI (`.github/workflows/ci.yml`, main dışı dallar ve PR'lar) ayrıca `build` ve `build:artifact` çalıştırır; `deploy.yml` main'e her push'ta `BASE_PATH=/<repo>/` ile GitHub Pages'e yayımlar. Lint/format betiği yok.

## Mimari

**Üç veri modu, derleme zamanında seçilir** (`VITE_API_MODE`, `src/data/index.ts` bir `TaskApi` seçer):
- `http` (varsayılan): `src/data/http.ts` → Hono sunucusu `server/src/index.ts` (`/api/meta`, `/api/tasks` CRUD, `APP_PASSWORD` ile isteğe bağlı koruma). Sunucu `TaskRepo` arayüzünü (`server/src/repo.ts`) `notionRepo.ts` (Notion API, data source uçları, `NOTION_VERSION=2025-09-03`) ya da token yoksa `demoRepo.ts` (`server/data/tasks.json`) ile karşılar; ayarlar `.env.example`'da.
- `local`: `src/data/local.ts`, kartlar `localStorage` `mp.local.tasks.v1` anahtarında (GitHub Pages bu modda çalışır). Bu anahtar ve biçim korunmalı.
- `mcp`: `src/data/mcpNotion.ts`, claude.ai artifact içinde görüntüleyenin Notion bağlayıcısını `window.claude.use("mcp")` ile çağırır (token sayfaya inmez).

Notion şeması ve tipler `shared/types.ts`'tedir (Görev, Alan, Durum, Öncelik, Tarih, Süre (dk), Not, Gün). Sunucu şemada olmayan select değerlerini reddeder (Notion sessizce yeni seçenek üretmesin diye).

**Durum.** Sunucu verisi `src/hooks/useTasks.ts`'te TanStack Query ile tutulur: tüm mutasyonlar iyimserdir (hata gelince geri alınır), son liste `mp.tasks.cache`'te saklanır. İyimser eklemede kart önce `temp-…` kimliği alır; gerçek kimlik gelince `src/lib/stableKey.ts` eşlemesi React anahtarını, `layoutId`'yi ve kart eğimini sabit tutar. Kullanıcı tercihleri `src/state/`'tedir: `prefsModel.ts` saf model + v1 göçü (test edilir), `prefs.tsx` kökte `data-theme` / `data-texture` / `data-pin` özniteliklerini yazar. `index.html`'deki erken betik aynı tema kurallarını titreşimsiz ilk boyama için tekrarlar (claude.ai'nin `data-theme="dark"`'ını `data-host-theme`'de saklar); kurallar değişirse ikisi birlikte güncellenmeli.

**Pano.** Tek pano, üç odak (Alanlar · Bugün · Hafta), kısayollar 1/2/3. Şeritler saf fonksiyonlardan gelir: `src/board/layouts.ts` (`buildLayout`, `byArea`/`byToday`/`byWeek`, `applyFilters`, bırakma değişikliğini hesaplayan `dropPatch`). "Bugün" dışarıdan (`h`) verilir ki gece yarısını geçen sekme doğru günü kullansın. `src/app/App.tsx` hepsini birleştirir: üst çubuk + ortadaki yuva (`Capsule`, `FilterMenu`, `DatePopover`) + `Board` + `SettingsDrawer` + `TaskDrawer`, ve klavye kısayolları (N, /, D, T, 1–3).

**`src/board/Board.tsx` (fizik), değiştirmeden önce bilinmesi gerekenler:**
- Masaüstünde pano kaydırması Motion drag'dir (`.board__lanes` üzerinde `x`/`y` MotionValue). `goal` ref'i süren yayın hedefini tutar; sınır ve hedef hesapları ara değere göre değil bu hedefe göre yapılır (`panTo`, `current`, `liveBounds`).
- Telefonda pano yerel `scroll-snap`'tir. Programatik kaydırmalar `scrollToLeft` ile aynı yayla yapılır, snap o sırada eşzamanlı kapatılır (`snapOff`/`snapOn`, `.is-free`). Kullanıcı araya girerse yapışma hareket bitene kadar kapalı kalır.
- Kartlar dnd-kit ile taşınır (MouseSensor distance 6, TouchSensor delay 180). `DragOverlay`'in bırakma animasyonu bilinçli olarak kapalıdır (`dropAnimation={null}`): kaynak kart görünüm dışındayken `scrollIntoView` panoyu sıçratıyordu.
- Her bırakma bir `FlightCard`'dır: `#root`'a portallanmış, sabit konumlu kopya, hedef yuvayı (`[data-lane]` içindeki `[data-card]`) her karede canlı izler. Yuva o sırada görünmezdir (`data-landing`); kopya yerine oturunca devreder.
- `AnimatePresence mode="popLayout"` ile çıkan şeritler DOM'da `data-motion-pop-id` ile kalır; DOM sorgularında bunları dışla.

**Tasarım token'ları.** `design/tokens.json` tek kaynaktır (4 tema: `amanita` varsayılan, `classic-cork`, `cupertino-glass`, `midnight-wood`; ayrıca fizik, yazı, boşluk ailesi). `src/styles/themes/*.css` üretilmiş dosyalardır, elle düzenleme; `npm run build:themes` çalıştır. `src/styles/tokens.css` eski değişken adlarını token'lara bağlar ve erişilebilirlik için türetilmiş renkleri tanımlar (`--vurgu-metin`, `--odak-renk`). Yay sabitleri token'dan `src/lib/physics.ts`'e gelir (`SPRING` 380/30/0.8, `PIN_SPRING`, `INSTANT`). Logo ve raptiye geometrisi `src/lib/brand.ts`'te; `Logo.tsx`, `Pin.tsx` ve `scripts/build-icons.mjs` buradan çizer.

## Kurallar

- Motion geçişleri `SPRING`/`INSTANT` kullanır; App `MotionConfig reducedMotion="user"` ile sarılıdır. Opaklık gibi transform dışı değerler için hareketi azaltta `INSTANT` ayrıca verilir.
- Bir yayı başlatmadan önce MotionValue'yu `jump()` ile ayarla, `set()` ile değil: `set()` hız bırakır ve yay hedefi aşar.
- Kart ve raptiye eğimi CSS'in bağımsız `rotate`/`translate` özelliklerindedir; `transform` Motion'a aittir.
- Kapanırken sönen paneller ve perdeler tıklama almamalı: `Scrim` ve `PresencePanel` (`useIsPresent`) kullan; dış tıklama/Esc için `useDismiss`, modal için `useFocusTrap` (`src/hooks/useDismiss.ts`).
- Artifact derlemesi yalnızca Fraunces'ı Google Fonts'tan yükler; arayüz metni sistem yazı tipidir.
- Belgeler: `README.md` (Türkçe + "In English (TL;DR)"), `docs/CASE_STUDY.md` (§1–7 v1, §8 v2). Arayüz değişince `build:static` + `build:screenshots` ile `docs/screenshots/` yenilenir.
