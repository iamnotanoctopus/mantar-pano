# Vaka Analizi — Mantar Pano

*Notion'daki bir görev veritabanını, tarayıcıda çalışan ve Notion ile canlı senkron olan bir "mantar pano"
uygulamasına dönüştürme. Tek kişilik ürün; tasarım, mimari, Notion entegrasyonu, retro etkileşim katmanı ve yayın.*

**Rol:** Ürün tasarımı + full-stack geliştirme · **Süre:** 1 gün (ilk sürüm) · **Stack:** React 19, TypeScript, Vite 7,
TanStack Query, dnd-kit, Hono, Notion API, Web Audio API · **Canlı:** GitHub Pages (local-first) + claude.ai artifact (Notion senkronu)

> Bu belgenin 1–7. bölümleri ilk sürümü (v1: beş sekme, dört "skin") anlatır.
> v2 yeniden tasarımı — tek pano, Amanita raptiye kimliği, token'dan üretilen dört tema ve yay fiziği — **§8**'dedir.

---

## 1. Problem

Görevlerimi Notion'da, "Görevlerim" adlı bir veritabanında tutuyordum: *Görev, Alan, Durum, Öncelik, Tarih, Süre, Not*
alanları ve beş görünüm (Pano, Bugün, Yaklaşanlar, Board, Takvim). Sistem doğruydu ama Notion'un arayüzü
günlük kullanımda iki şeyi vermiyordu:

1. **Bakışta kavrama.** Bir panoya bakıp "bu hafta ne var, ne gecikti, ne kadar sürer" sorusunu üç saniyede
   yanıtlamak. Notion'da bu, görünümler arasında gezmeyi gerektiriyordu.
2. **Hız ve his.** Kart eklemek, tamamlamak, taşımak birkaç tıkla ve bir geri bildirimle olmalıydı — fiziksel bir
   mantar panoya iğne batırmak gibi.

Kısıt: Veri Notion'da kalmalı (tek doğruluk kaynağı), ama uygulama Notion olmadan da açılabilmeli.

## 2. Hedefler ve ölçütler

| Hedef | Ölçüt |
|---|---|
| Notion'daki kurguyu bire bir korumak | 5 görünümün filtre/sıralama kuralları uygulamada aynı sonucu versin |
| "Bu hafta" bir bakışta | Pano: Bitti olmayan ∧ (Tarih ≤ +7 gün ∨ tarihsiz), alanlara göre sütun, süre toplamı sütun başlığında |
| Hissedilir hız | Her yazma optimistic: ekran anında değişir, hata olursa geri alınır |
| Notion'suz da çalışır | Local-first mod: hesap/sunucu yok, kartlar tarayıcıda, JSON ile taşınır |
| Telefonda kullanılabilir | 390px'te yatay kaydırmasız; alt gezinme, alan çipleri, alt-sayfa çekmece |

## 3. Keşif: Notion şemasını okumak

Uygulamayı yazmadan önce Notion'daki veri kaynağını ve görünümleri programatik olarak okudum (MCP ile). Görünümlerin
filtreleri JSON olarak elimdeydi; bunları `src/lib/views.ts` içinde saf fonksiyonlara çevirdim:

```ts
// 📌 Pano: Bitti değil ∧ (Tarih ≤ bugün+7 ∨ Tarih boş) · Alan'a göre grupla · Tarih ↑
export function boardTasks(tasks, h = horizon()) {
  return tasks.filter((t) => !isDone(t) && (t.date === null || t.date <= h.weekAhead)).sort(byDate);
}
```

Notion'daki **Gün** formülü (Bugün / Yarın / gün adı / tarih / "3 gün gecikti") API'den okunamıyordu; istemci tarafında
`dayLabel()` ile yeniden ürettim. Böylece etiket Notion'un gecikmeli formül hesabına değil, cihaz saatine göre her
zaman taze.

## 4. Mimari kararlar

### 4.1 Tek arayüz, üç veri katmanı

Notion API tarayıcıdan doğrudan çağrılamıyor (CORS) ve token tarayıcıya inmemeli. Ama "yalnızca sunucuyla çalışır"
bir ürün de istemiyordum. Çözüm: `TaskApi` arayüzü (`meta / tasks / create / update / remove`) ve üç uygulama:

| Katman | Nerede çalışır | Veri |
|---|---|---|
| `local.ts` | Tarayıcı | localStorage; örnek kartlar "bugün"e göre üretilir, demo her açılışta canlı |
| `http.ts` + `server/` | Hono sunucusu | Notion API 2025-09-03 (data source uçları), 20 sn önbellek, yazmalar önbelleğe anında işlenir |
| `mcpNotion.ts` | claude.ai artifact | Görüntüleyenin kendi Notion bağlayıcısı; token hiç yok, yetki kullanıcıda |

Mod derleme zamanında seçilir (`VITE_API_MODE`); arayüz kodu ve TanStack Query kancaları hiçbirini bilmez.
Bu, aynı kod tabanından üç ürün çıkarmayı mümkün kıldı: statik demo, kendi sunuculu kurulum ve sunucusuz Notion panosu.

### 4.2 Optimistic yazma, geri alma, yerel önbellek

Her mutasyon önce TanStack Query önbelleğine yazılır, sonra ağa gider; hata gelirse önceki anlık görüntü geri konur ve
bir uyarı gösterilir. Son başarılı liste `localStorage`'da tutulur: uygulama açılır açılmaz boyanır, sonra tazelenir.
Notion'a bilinmeyen bir select değeri gönderilmez — Notion böyle durumlarda sessizce yeni seçenek üretir ve veritabanı
kirlenir; sunucu şemaya karşı doğrular ve 400 döner.

### 4.3 Tasarım sistemi: token'lar ve "skin"ler

> v2'de bu düzen kaldırıldı: `data-skin`, `scripts/themes.mjs` ve Inter yerine `design/tokens.json` → dört
> `data-theme` dosyası ve Fraunces + sistem yazı tipi geldi (§8.3–8.4).

Tüm renk, yarıçap, gölge ve yazı tipi kararları `:root` token'larıdır. Koyu tema üç durumu kapsar (sistem / açık / koyu
seçimi); görünüm temaları (`data-skin`) yalnızca token'ları ezer, bileşen CSS'i tema bilmez. Dört tema tek bir JS
tanımından üretilir (`scripts/themes.mjs` → CSS), böylece yeni bir tema eklemek ~60 satırlık bir nesne yazmaktır.

Sıcak hibrit stil: kâğıt hissi veren kartlar, Alan rengine göre iğneler, SVG `feTurbulence` ile üretilen mantar dokusu
(görsel dosya yok), Fraunces + Inter tipografisi (self-hosted).

### 4.4 Retro etkileşim katmanı: dürtme ve sesler

**Dürtme (MSN Nudge).** Pencere titremesi `transform` yerine `left/top` ile yapılır: transform, sabit konumlu alt menü
ve çekmecenin bağlam kutusunu değiştirip onları ekrandan kaydırıyordu. 620 ms, azalan genlikli 10 kare.
`prefers-reduced-motion` açıksa titreme yerine çerçeve parlaması. Tetikleyiciler: `D` tuşu, buton, ya da açılışta
gecikmiş kart varsa (oturumda bir kez).

**Sesler (Web Audio API).** Ses dosyası yok; her efekt osilatör + kazanç zarfıdır (pin: gürültü patlaması + tiz blip;
bitti: A5→D6; sil: alçalan testere dişi; dürtme: iki kare dalga vuru + 26 Hz vibrato + 18 Hz tremolo). Tek
`AudioContext` ilk tıklamada açılır (autoplay politikası), düğümler `onended`'da kopar; ölçülebilir bir maliyet yok.

### 4.5 Mobil

Pano sütunları yatay kaydırmalı ve kaydırma-kilitli (`scroll-snap`); üstte alan çipleri sütuna atlar. Çekmece alt sayfa
olur; alt gezinme çubuğu beş görünümü ve "+" düğmesini taşır. Dokunmatik sürükleme 180 ms basılı tutma ile başlar ki
kaydırmayla çakışmasın.

## 5. Doğrulama

- **Birim:** Notion eşleme katmanı sahte `fetch` ile test edildi — şema okuma, sayfa→kart eşlemesi, oluşturma/güncelleme
  gövdeleri, bilinmeyen seçeneğin reddi, arşivleme (`npm test`).
- **Uçtan uca (Playwright):** üç derleme modunda da ekle → düzenle → tamamla → sürükle → sil akışı; local-first
  kalıcılık (yenileme sonrası kart duruyor); tema seçiminin kalıcılığı; dürtme sınıfının eklenmesi; JSON dışa aktarma.
- **Görsel:** masaüstü/mobil, açık/koyu, dört tema için ekran görüntüleri (`docs/screenshots`; v1 görüntüleri v2'de
  yenileriyle değiştirildi).

## 6. Sonuç

- Notion'daki beş görünüm, aynı kurallarla ve sütun başlığında süre toplamıyla tek ekranda.
- Her yazma anında görünür; Notion gecikmesi kullanıcıya yansımaz.
- Aynı kod tabanından üç dağıtım: statik demo (GitHub Pages), sunuculu kurulum, sunucusuz Notion panosu (claude.ai).
- İlk derleme: ~345 KB JS (gzip ~108 KB), ses/doku için sıfır medya dosyası.

## 7. Öğrendiklerim / tekrar yapsam

- **Önce şemayı oku, sonra tasarla.** Görünüm kurallarını JSON olarak elde edince arayüz kararları tartışmasız hale geldi.
- **Transform her yerde iyi değil.** Sabit konumlu öğelerle dolu bir sayfada "pencereyi titretmek" için `left/top`
  animasyonu daha güvenli; tek seferlik 620 ms için layout maliyeti önemsiz.
- **Temayı veri olarak tut.** CSS'i elle çoğaltmak yerine tek tanımdan üretmek, dört temanın dört modda (açık/koyu ×
  sistem/seçim) tutarlı kalmasını sağladı.
- Sırada: çevrimdışı yazma kuyruğu ve Notion ile çift yönlü birleştirme; masaüstü (Tauri) ve mobil (Capacitor) paketleri.

## 8. v2 — tek pano, Amanita raptiye, yay fiziği

### 8.1 Neden

v1 Notion'daki beş görünümü beş sekmeye taşımıştı. Kullanırken iki sorun çıktı: sekmeler arasında gezmek
"bakışta kavrama" hedefini zayıflatıyordu ve her görünüm ayrı bir sayfa gibi davranıp kartların yerini
kaybettiriyordu. v2'nin ilkesi: **pano her şeydir**. Eski görünümlerin işe yarayan tarafları panonun üstünde
*odak* ve *süzgeç* olarak yaşar; kartlar yeni bir sayfaya gitmez, yerlerine yaylanarak kayar.

### 8.2 Beş sekme → üç odak + bir süzgeç

| v1 sekmesi | v2 karşılığı | Kural (`src/board/layouts.ts`) |
|---|---|---|
| Pano | **Alanlar** odağı (1) | Bitti değil ∧ (Tarih ≤ +7 ∨ tarihsiz), alan şeritleri; arama yapılırken ufuk kalkar |
| Bugün | **Bugün** odağı (2) | Gecikenler · Bugün · Yarın, öncelik ↑ |
| Yaklaşanlar | **Hafta** odağı (3) | Pzt … Paz + Tarihsiz; ‹ › ile haftalar arasında |
| Takvim | Hafta odağının tarih şeridi (T) | Ay ızgarası popover'ı; gün seçilince pano o haftaya kayar |
| Tümü | Süz + Ara | Alan (çoklu), öncelik (çoklu), bitmişleri göster; her odakta |

Sürükle-bırak da odağa göre anlam kazandı: Alanlar'da alan, Bugün/Yarın'da tarih, Hafta'da gün değişir;
Tarihsiz şeridi tarihi siler, Gecikenler'e bırakılamaz. Odakların hepsi saf fonksiyon ve testli
(`src/test/layouts.test.ts`); "N kart odak dışında" notu görünmeyen kart sayısını söyler.

### 8.3 Token'dan üretilen temalar

Tasarım sistemi bir `tokens.json` olarak geldi (32 renk token'ı × 4 tema, 4 gölge, boşluk, köşe, yazı, fizik).
Dosya olduğu gibi `design/tokens.json` oldu; Notion'daki token tablosuyla programatik olarak karşılaştırıldı
(32/32 eşleşti). `scripts/build-themes.mjs` her temayı `[data-theme]` bloğuna, ortak değerleri `:root`'a yazar.
Düzyazıyla anlatılan tema farkları (cam temada 1px çerçeve ve buzlu pano, Midnight'ta koyu renk şeması)
`yapi` ailesine token olarak eklendi; böylece kural "bileşen temayı bilmez, yalnızca token okur" istisnasız kaldı.
v1 bileşenlerini bozmamak için eski değişken adları yeni token'lara eşlendi (`--card-bg: var(--kart-yuzey)`).

Tercihler göç eder (`src/state/prefsModel.ts`, testli): `skin` → `theme` (her v1 kullanıcısı Klasik'e, açıkça koyu
seçen Midnight Wood'a), `view` → `focus`; doku, raptiye stili, süzgeç ve "bitmişleri göster" eklenir.

### 8.4 Kimlik: Amanita raptiye

Logo, beyaz benekli bir *Amanita muscaria* şapkası ile panoya saplanan metal iğnenin birleşimi. Geometri tek bir
modülde (`src/lib/brand.ts`); logo, dört kart raptiyesi (mini mantar, kırmızı küre, yassı metalik, pastel disk)
ve uygulama ikonları aynı kaynaktan çizilir. İkonlar Playwright ile rasterize edilir (`npm run build:icons`).
Renkler `raptiye-*` token'larından geldiği için silüet her temada aynı, renk temaya göre değişir.

### 8.5 Fizik, süre değil

Hiçbir geçiş `linear` ya da `150ms ease-in-out` değil; her hareket bir yay. Değerler token'dan okunur
(`src/lib/physics.ts`) ve Motion'ın `MotionConfig`'ine varsayılan olarak verilir.

| Olay | Uygulama |
|---|---|
| Kart tutuldu | ölçek 1.03, sürükleme yönüne göre ±1.5°, gölge `golge-kart-kaldir`, raptiye 3px yukarı (yay 380/30/0.8) |
| Başka şeride bırakıldı | kart (uçuş kopyası) bırakıldığı noktadan, ölçekli ve eğik hâlinden yeni yerine yaylanır; raptiye 1.2 → 1.0 (520/18) |
| Aynı şeride / iptal | kart aynı iniş yayıyla, bırakıldığı noktadan eski yerine döner; raptiye yine 1.2 → 1.0 |
| Odak/süzgeç değişti | kartlar `layoutId` ile yeni şeride kayar, çıkanlar `opacity 0 · scale 0.96` ile söner |
| Pano kaydırıldı | boş yüzeyden sürükle; atalet power 0.8, timeConstant ~350 ms; kenarda `dragElastic` direnci |
| Çekmece | sağdan `x: 100% → 0` (telefonda alttan) |

İki tuzak öğretici oldu. **(1)** dnd-kit'in bırakma animasyonu kartı *eski* yerine götürüyordu, çünkü kart
optimistic güncellemeyle başka şeride taşınmış ve yeni bir düğüm olmuştu; bir an iki kopya görünüyordu. Çözüm:
kart başka şeride bırakılınca dnd-kit'in animasyonunu kapatıp kartı yeni yerinde, bırakıldığı noktadan yaylamak.
**(2)** Odak değişince şeritler bütünüyle sönüp yeniden belirdiği için pano bir an boş kalıyordu; Motion'ın
`popLayout` modu da React 19'da ref'i DOM'a bağlamayan bileşenleri ölçemiyordu. Şeridi söndürmek yerine yalnızca
başlığını canlandırmak ve ref'i hem dnd-kit'e hem AnimatePresence'a bağlamak kartların gerçekten kaymasını sağladı.
Kart ve raptiye eğimleri de CSS'in bağımsız `rotate`/`translate` özelliklerine taşındı ki Motion'ın `transform`'uyla çakışmasın.

**(3)** Birleştirmeden önce üç bağımsız inceleme (mantık, fizik ve erişilebilirlik, şartnameye uyum) ve ardından beş
doğrulama turu (her bulguyu Playwright ile yeniden üreten bir ajan + onu çürütmeye çalışan ikinci bir ajan) yapıldı;
en öğretici bulgular zamanlamaydı:

- İyimser güncelleme `cancelQueries`'i beklediği için kart bir çizim boyunca *hâlâ eski şeritteydi*; iniş animasyonu o
  eski kopyaya uygulanıyor, sonra bir kare boş kalıyordu. dnd-kit'in geri dönüş animasyonu da kaynak kart görünüm
  dışındayken `scrollIntoView` ile panoyu tek karede sıçratıyordu. Sonuçta her bırakma (başka şerit, aynı şerit, iptal)
  tek bir yolla oynar: gövdeye bağlı bir **uçuş kopyası** bırakıldığı yerden başlar, hedef yuvayı her karede canlı izler
  (yuva o sırada görünmez), yerine oturunca yuvaya devreder. Hiçbir kaydırma kutusu onu kırpmaz, pano kayarken de doğru
  yere iner; pano (telefonda kaydırma) aynı anda aynı yayla hizalandığı için kart ekranda tek bir yay çizer.
- Odak değişince başa kayan yay, aynı anda daralan sınırı gören ikinci bir yayla eziliyordu: sınır artık o anki ara
  değere değil gidilen hedefe göre uygulanır. Hedefler de dönüşümsüz yerleşimden (`offsetLeft`) hesaplanır; yerleşim
  yayındaki şeritlere göre ölçmek birkaç piksel kısa bırakıyordu.
- Telefonda scroll-snap'i bir kaydırmanın ortasında geri açmak tarayıcıyı tek karede en yakın noktaya sıçratıyor: snap,
  hizalama yayı (ya da kullanıcının kaydırması) bitene kadar kapalı kalır.
- Pano `transform` ile kaydığından dnd-kit'in bırakma alanı ölçüleri eskiyordu; kenarda bekleyen kartta pano kaydıkça
  ölçüler yenilenir. İyimser `temp-…` kimliği gerçeğiyle değişince kart yeniden doğuyordu: React anahtarı, `layoutId` ve
  eğim artık oturum boyunca kararlı bir anahtara bağlı (`src/lib/stableKey.ts`).
- Kapanış yayı süren perde ve paneller tıklamayı yutuyordu; `useIsPresent` ile kapanırken tıklanmaz olurlar.

### 8.6 Ölçümler

| | v1 | v2 |
|---|---|---|
| Gezinme öğesi | 5 sekme + mobil alt çubuk | 1 kapsül + 1 çekmece |
| Tema üretimi | elle yazılmış JS nesnesi | `tokens.json` → 4 CSS dosyası |
| JS paketi (gzip) | ~113 KB | ~165 KB (Motion ~50 KB) |
| Testler | 1 dosya (Notion eşleme) | 3 dosya (+ tercih göçü, pano odakları ve bırakma kuralı) |
| Varsayılan yay oturma süresi | — | ~460 ms (380/30/0.8, ζ ≈ 0.86) |

Doğrulama: her adımda `typecheck · test · build:static`; Playwright ile pan sınırı ve kenar direnci, kartın
şerit değiştirmesi ve kalıcılığı, odak değişiminde ara kareler, çekmecenin açılıp odağın dişliye dönmesi,
telefonda scroll-snap ve "hareketi azalt" altında anında geçişler sınandı. Ekran görüntüleri
`npm run build:screenshots` ile üretilir (4 tema × masaüstü/telefon, üç odak, ayarlar ve telefonda Süz).

### 8.7 Sırada

Kartlar arası elle sıralama (şerit içinde), Hafta odağında haftalar arasında sürekli yatay kaydırma ve
Motion'ı `LazyMotion` ile bölerek paket boyutunu küçültmek.

---

*Kod: `design/` (token'lar), `src/` (istemci), `server/` (Hono API), `shared/` (tipler), `scripts/` (derleme, tema, ikon ve ekran görüntüsü üretimi).*
