/**
 * Uygulamanın istemci ve sunucu tarafında ortak kullandığı alan modeli.
 * Notion'daki "Görevlerim" veri kaynağının birebir karşılığıdır:
 *
 *   Görev (title) · Alan (select) · Durum (status) · Öncelik (select)
 *   Tarih (date) · Süre (dk) (number) · Not (rich text) · Gün (formula)
 */

export type NotionColor =
  | "default"
  | "gray"
  | "brown"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "red";

export interface SelectOption {
  name: string;
  color: NotionColor;
}

export type StatusGroup = "to_do" | "in_progress" | "complete";

export interface StatusOption extends SelectOption {
  group: StatusGroup;
}

export interface Task {
  /** Notion sayfa kimliği (demo modunda yerel kimlik). */
  id: string;
  /** Görev */
  title: string;
  /** Alan */
  area: string | null;
  /** Durum */
  status: string;
  /** Öncelik */
  priority: string | null;
  /** Tarih (başlangıç) — YYYY-MM-DD */
  date: string | null;
  /** Tarih (bitiş) — aralık ise */
  dateEnd: string | null;
  /** Süre (dk) */
  duration: number | null;
  /** Not */
  note: string;
  /** Notion'daki "Gün" formülünün son değeri (istemci kendi hesabını da yapar). */
  dayLabel: string | null;
  /** Notion sayfa bağlantısı */
  url: string | null;
  createdTime: string;
  lastEditedTime: string;
}

export interface TaskInput {
  title: string;
  area?: string | null;
  status?: string;
  priority?: string | null;
  date?: string | null;
  dateEnd?: string | null;
  duration?: number | null;
  note?: string;
}

export type TaskPatch = Partial<TaskInput>;

export interface Schema {
  areas: SelectOption[];
  statuses: StatusOption[];
  priorities: SelectOption[];
}

export interface ServerMeta {
  mode: "notion" | "demo" | "local";
  dataSourceId: string | null;
  dataSourceTitle: string | null;
  notionUrl: string | null;
  schema: Schema;
  /** Sunucunun en son Notion'dan başarıyla veri çektiği an (ISO). */
  lastSyncAt: string | null;
}

/** Notion'daki mevcut seçenekler — şema çekilemezse yedek olarak kullanılır. */
export const DEFAULT_SCHEMA: Schema = {
  areas: [
    { name: "İş", color: "blue" },
    { name: "Görünürlük", color: "orange" },
    { name: "Okul", color: "green" },
    { name: "Kişisel", color: "pink" },
  ],
  statuses: [
    { name: "Yapılacak", color: "gray", group: "to_do" },
    { name: "Sürüyor", color: "blue", group: "in_progress" },
    { name: "Bitti", color: "green", group: "complete" },
  ],
  priorities: [
    { name: "Yüksek", color: "red" },
    { name: "Orta", color: "yellow" },
    { name: "Düşük", color: "gray" },
  ],
};

export const STATUS_DONE = "Bitti";
export const STATUS_TODO = "Yapılacak";
export const STATUS_DOING = "Sürüyor";
