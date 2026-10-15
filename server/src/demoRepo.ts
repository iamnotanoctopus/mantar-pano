import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { DEFAULT_SCHEMA, STATUS_TODO, type ServerMeta, type Task, type TaskInput, type TaskPatch } from "../../shared/types.ts";
import { DEMO_ROWS } from "../../shared/demoRows.ts";
import { HttpError, validatePatch, type TaskRepo } from "./repo.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(here, "../data");
const DATA_FILE = path.join(DATA_DIR, "tasks.json");

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Örnek kartları bugüne göre tarihlendirerek üret. */
function seed(): Task[] {
  const now = new Date().toISOString();
  return DEMO_ROWS.map((r, i) => {
    const d = new Date();
    if (r.offset !== null && r.offset !== undefined) d.setDate(d.getDate() + r.offset);
    return {
      id: `demo-${String(i + 1).padStart(2, "0")}`,
      title: r.title,
      area: r.area,
      status: r.status ?? STATUS_TODO,
      priority: r.priority ?? null,
      date: r.offset === null || r.offset === undefined ? null : isoDate(d),
      dateEnd: null,
      duration: r.duration ?? null,
      note: r.note ?? "",
      dayLabel: null,
      url: null,
      createdTime: now,
      lastEditedTime: now,
    };
  });
}

/**
 * Demo / çevrimdışı depo: Notion'daki görevlerin bir kopyasını JSON dosyasında tutar.
 * NOTION_TOKEN tanımlı değilken ya da DATA_MODE=demo iken kullanılır.
 */
export class DemoRepo implements TaskRepo {
  private tasks: Task[] | null = null;
  private writing: Promise<void> = Promise.resolve();

  private async load(): Promise<Task[]> {
    if (this.tasks) return this.tasks;
    try {
      const raw = await fs.readFile(DATA_FILE, "utf8");
      this.tasks = JSON.parse(raw) as Task[];
    } catch {
      this.tasks = seed();
      await fs.mkdir(DATA_DIR, { recursive: true });
      await this.persist();
    }
    return this.tasks!;
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.tasks ?? [], null, 2);
    this.writing = this.writing.then(() => fs.writeFile(DATA_FILE, snapshot, "utf8"));
    return this.writing;
  }

  async meta(): Promise<ServerMeta> {
    return {
      mode: "demo",
      dataSourceId: null,
      dataSourceTitle: "Örnek kartlar (yerel)",
      notionUrl: null,
      schema: DEFAULT_SCHEMA,
      lastSyncAt: null,
    };
  }

  async list(): Promise<Task[]> {
    const tasks = await this.load();
    return [...tasks].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  }

  async create(input: TaskInput): Promise<Task> {
    const tasks = await this.load();
    const p = validatePatch(input, DEFAULT_SCHEMA, true);
    const now = new Date().toISOString();
    const id = randomUUID().replace(/-/g, "");
    const task: Task = {
      id,
      title: p.title!,
      area: p.area ?? null,
      status: p.status ?? STATUS_TODO,
      priority: p.priority ?? null,
      date: p.date ?? null,
      dateEnd: p.dateEnd ?? null,
      duration: p.duration ?? null,
      note: p.note ?? "",
      dayLabel: null,
      url: null,
      createdTime: now,
      lastEditedTime: now,
    };
    tasks.push(task);
    await this.persist();
    return task;
  }

  async update(id: string, patch: TaskPatch): Promise<Task> {
    const tasks = await this.load();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx < 0) throw new HttpError(404, "Kart bulunamadı.");
    const p = validatePatch(patch, DEFAULT_SCHEMA);
    const next: Task = { ...tasks[idx], ...p, lastEditedTime: new Date().toISOString() } as Task;
    if (p.title !== undefined && !p.title) next.title = tasks[idx].title; // boş başlığa izin verme
    tasks[idx] = next;
    await this.persist();
    return next;
  }

  async archive(id: string): Promise<void> {
    const tasks = await this.load();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx < 0) throw new HttpError(404, "Kart bulunamadı.");
    tasks.splice(idx, 1);
    await this.persist();
  }
}
