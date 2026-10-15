# Vaka Analizi — Mantar Pano

*Notion'daki bir görev veritabanını, tarayıcıda çalışan ve Notion ile canlı senkron olan bir "mantar pano"
uygulamasına dönüştürme. Tek kişilik ürün; tasarım, mimari, Notion entegrasyonu, retro etkileşim katmanı ve yayın.*

**Rol:** Ürün tasarımı + full-stack geliştirme · **Süre:** 1 gün (ilk sürüm) · **Stack:** React 19, TypeScript, Vite 7,
TanStack Query, dnd-kit, Hono, Notion API, Web Audio API · **Canlı:** GitHub Pages (local-first) + claude.ai artifact (Notion senkronu)

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
- **Görsel:** masaüstü/mobil, açık/koyu, dört tema için ekran görüntüleri (`docs/screenshots`).

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

---

*Kod: `src/` (istemci), `server/` (Hono API), `shared/` (tipler), `scripts/` (derleme/tema üretimi).*
