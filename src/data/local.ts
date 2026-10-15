/**
 * Local-first veri katmanı: kartlar tarayıcının localStorage'ında saklanır,
 * ağ gerekmez. Statik yayınlar (GitHub Pages) ve çevrimdışı kullanım için.
 * JSON dışa/içe aktarma ile veriler taşınabilir.
 */
import { DEFAULT_SCHEMA, STATUS_TODO, type ServerMeta, type Task, type TaskInput, type TaskPatch } from "@shared/types";
import { demoSeed } from "./demoSeed";
import { ApiError, type TaskApi } from "./http";

const KEY = "mp.local.tasks.v1";

function read(): Task[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr as Task[]) : null;
  } catch {
    return null;
  }
}

function write(tasks: Task[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks));
  } catch {
    /* depolama kapalı olabilir; bellekte devam */
  }
}

let memory: Task[] | null = null;

function load(): Task[] {
  if (memory) return memory;
  memory = read() ?? demoSeed();
  write(memory);
  return memory;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const localApi: TaskApi & {
  exportJson(): string;
  importJson(json: string): number;
  resetDemo(): void;
} = {
  async meta(): Promise<ServerMeta> {
    return {
      mode: "local",
      dataSourceId: null,
      dataSourceTitle: "Bu cihaz",
      notionUrl: null,
      schema: DEFAULT_SCHEMA,
      lastSyncAt: null,
    };
  },

  async tasks() {
    return { tasks: [...load()], syncedAt: new Date().toISOString() };
  },

  async create(input: TaskInput): Promise<Task> {
    const title = input.title.trim();
    if (!title) throw new ApiError(400, "Kart adı boş olamaz.");
    const now = new Date().toISOString();
    const task: Task = {
      id: newId(),
      title,
      area: input.area ?? null,
      status: input.status ?? STATUS_TODO,
      priority: input.priority ?? null,
      date: input.date ?? null,
      dateEnd: input.dateEnd ?? null,
      duration: input.duration ?? null,
      note: input.note ?? "",
      dayLabel: null,
      url: null,
      createdTime: now,
      lastEditedTime: now,
    };
    const tasks = load();
    tasks.push(task);
    write(tasks);
    return task;
  },

  async update(id: string, patch: TaskPatch): Promise<Task> {
    const tasks = load();
    const i = tasks.findIndex((t) => t.id === id);
    if (i < 0) throw new ApiError(404, "Kart bulunamadı.");
    const next = { ...tasks[i], ...patch, lastEditedTime: new Date().toISOString() } as Task;
    if (patch.title !== undefined && !patch.title.trim()) next.title = tasks[i].title;
    tasks[i] = next;
    write(tasks);
    return next;
  },

  async remove(id: string): Promise<void> {
    const tasks = load();
    const i = tasks.findIndex((t) => t.id === id);
    if (i < 0) throw new ApiError(404, "Kart bulunamadı.");
    tasks.splice(i, 1);
    write(tasks);
  },

  exportJson() {
    return JSON.stringify({ app: "mantar-pano", version: 1, exportedAt: new Date().toISOString(), tasks: load() }, null, 2);
  },

  importJson(json: string) {
    const parsed = JSON.parse(json) as { tasks?: unknown } | unknown[];
    const arr = Array.isArray(parsed) ? parsed : (parsed as { tasks?: unknown }).tasks;
    if (!Array.isArray(arr)) throw new Error("Dosyada kart listesi yok.");
    const tasks = (arr as Partial<Task>[])
      .filter((t) => t && typeof t.title === "string")
      .map((t) => ({
        id: typeof t.id === "string" && t.id ? t.id : newId(),
        title: t.title!,
        area: t.area ?? null,
        status: t.status ?? STATUS_TODO,
        priority: t.priority ?? null,
        date: t.date ?? null,
        dateEnd: t.dateEnd ?? null,
        duration: t.duration ?? null,
        note: t.note ?? "",
        dayLabel: null,
        url: t.url ?? null,
        createdTime: t.createdTime ?? new Date().toISOString(),
        lastEditedTime: t.lastEditedTime ?? new Date().toISOString(),
      }));
    memory = tasks;
    write(tasks);
    return tasks.length;
  },

  resetDemo() {
    memory = demoSeed();
    write(memory);
  },
};
