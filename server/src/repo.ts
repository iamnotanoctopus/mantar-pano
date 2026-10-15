import type { Schema, ServerMeta, Task, TaskInput, TaskPatch } from "../../shared/types.ts";

/**
 * Görev deposu arayüzü. İki uygulaması var:
 *  - NotionRepo: Notion API üzerinden canlı okuma/yazma
 *  - DemoRepo : server/data/tasks.json dosyasında yerel kopya (token yokken)
 *
 * Daha sonra masaüstü (Tauri) ya da mobil (Capacitor) sürümlerinde aynı arayüz
 * doğrudan cihaz üzerinde de uygulanabilir.
 */
export interface TaskRepo {
  meta(): Promise<ServerMeta>;
  list(opts?: { fresh?: boolean }): Promise<Task[]>;
  create(input: TaskInput): Promise<Task>;
  update(id: string, patch: TaskPatch): Promise<Task>;
  archive(id: string): Promise<void>;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const optionNames = (opts: { name: string }[]) => opts.map((o) => o.name);

/**
 * Notion'a bilinmeyen bir select adı gönderilirse Notion o seçeneği otomatik
 * oluşturur. Bunu istemiyoruz; bu yüzden her yazma şemaya karşı doğrulanır.
 */
export function validatePatch(patch: TaskPatch, schema: Schema, isCreate = false): TaskPatch {
  const out: TaskPatch = {};

  if (patch.title !== undefined) {
    if (typeof patch.title !== "string") throw new HttpError(400, "Görev metin olmalı.");
    const title = patch.title.trim();
    if (isCreate && !title) throw new HttpError(400, "Görev adı boş olamaz.");
    out.title = title;
  } else if (isCreate) {
    throw new HttpError(400, "Görev adı gerekli.");
  }

  if (patch.area !== undefined) {
    if (patch.area !== null && !optionNames(schema.areas).includes(patch.area)) {
      throw new HttpError(400, `Bilinmeyen alan: ${patch.area}`);
    }
    out.area = patch.area;
  }

  if (patch.status !== undefined) {
    if (!optionNames(schema.statuses).includes(patch.status)) {
      throw new HttpError(400, `Bilinmeyen durum: ${patch.status}`);
    }
    out.status = patch.status;
  }

  if (patch.priority !== undefined) {
    if (patch.priority !== null && !optionNames(schema.priorities).includes(patch.priority)) {
      throw new HttpError(400, `Bilinmeyen öncelik: ${patch.priority}`);
    }
    out.priority = patch.priority;
  }

  if (patch.date !== undefined) {
    if (patch.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(patch.date)) {
      throw new HttpError(400, "Tarih YYYY-AA-GG biçiminde olmalı.");
    }
    out.date = patch.date;
  }

  if (patch.dateEnd !== undefined) {
    if (patch.dateEnd !== null && !/^\d{4}-\d{2}-\d{2}$/.test(patch.dateEnd)) {
      throw new HttpError(400, "Bitiş tarihi YYYY-AA-GG biçiminde olmalı.");
    }
    out.dateEnd = patch.dateEnd;
  }

  if (patch.duration !== undefined) {
    if (patch.duration !== null && (typeof patch.duration !== "number" || !Number.isFinite(patch.duration) || patch.duration < 0)) {
      throw new HttpError(400, "Süre pozitif bir sayı olmalı.");
    }
    out.duration = patch.duration;
  }

  if (patch.note !== undefined) {
    if (typeof patch.note !== "string") throw new HttpError(400, "Not metin olmalı.");
    out.note = patch.note;
  }

  return out;
}
