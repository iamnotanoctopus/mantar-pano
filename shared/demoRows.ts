/**
 * Nötr örnek kartlar — hem tarayıcıdaki local-first modun hem de sunucunun demo modunun
 * başlangıç verisi. Tarihler "bugün"e göre gün farkı (offset) olarak tutulur; böylece
 * demo her açılışta canlı görünür (gecikmiş, bugün, bu hafta, sonraki haftalar).
 */
import { STATUS_DOING, STATUS_DONE } from "./types.ts";

export interface DemoRow {
  title: string;
  area: string | null;
  status?: string;
  priority?: string | null;
  /** bugünden gün farkı; null → tarihsiz */
  offset?: number | null;
  duration?: number | null;
  note?: string;
}

export const DEMO_ROWS: DemoRow[] = [
  { title: "Sprint planını yaz", area: "İş", priority: "Yüksek", offset: -1, duration: 45, note: "Üç hedef, her biri için bir ölçüt. Toplantıdan önce ekibe gönder." },
  { title: "Müşteri demosu provası", area: "İş", priority: "Yüksek", offset: 0, duration: 30, note: "Akış: giriş → pano → Notion senkronu. Soru listesini hazırla." },
  { title: "Haftalık rapor", area: "İş", priority: "Orta", offset: 2, duration: 30, note: "Rakamlar + 3 madde + sonraki hafta." },
  { title: "Tasarım geri bildirimi", area: "İş", status: STATUS_DOING, priority: "Orta", offset: 1, duration: 20 },
  { title: "Fatura kes", area: "İş", status: STATUS_DONE, priority: "Düşük", offset: -3, duration: 10 },

  { title: "LinkedIn yazısı: öğrendiğim 3 şey", area: "Görünürlük", priority: "Orta", offset: 3, duration: 45, note: "Sade anlatım, bir örnek, kaynak. Reklam yok." },
  { title: "GitHub README'yi güncelle", area: "Görünürlük", priority: "Orta", offset: 5, duration: 60, note: "Ne, neden, nasıl çalışıyor. Ekran görüntüsü ekle." },
  { title: "Haftalık plan ve ağ", area: "Görünürlük", priority: "Düşük", offset: 6, duration: 30, note: "Gelecek haftanın 2 konusunu seç, 3 yorum yap, 1 kişiye mesaj at." },
  { title: "Podcast konukluğu için mesaj", area: "Görünürlük", priority: "Orta", offset: 12, duration: 30 },

  { title: "Lineer cebir ödevi", area: "Okul", priority: "Yüksek", offset: 1, duration: 90, note: "Soru 4 ve 7'yi önce çöz; ispatı adım adım yaz." },
  { title: "Makale özeti: dikkat mekanizmaları", area: "Okul", priority: "Orta", offset: 4, duration: 60 },
  { title: "Proje sunumu", area: "Okul", priority: "Yüksek", offset: 14, duration: 120, note: "10 slayt, 8 dakika. Demo videosu hazırla." },

  { title: "Koşu — 5 km", area: "Kişisel", priority: "Orta", offset: 0, duration: 35 },
  { title: "Anneme ara", area: "Kişisel", priority: "Yüksek", offset: null, duration: 15 },
  { title: "Kitap: 40 sayfa", area: "Kişisel", priority: "Düşük", offset: 2, duration: 40 },
  { title: "Diş hekimi randevusu", area: "Kişisel", priority: "Orta", offset: 9, duration: 60, note: "Saat 14:30, kimliği unutma." },
];
