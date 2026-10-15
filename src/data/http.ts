import type { ServerMeta, Task, TaskInput, TaskPatch } from "@shared/types";

/**
 * İnce HTTP istemcisi. Tüm Notion mantığı sunucuda; istemci yalnızca temiz
 * alan modeliyle konuşur. Masaüstü/mobil sürümlerde BASE farklı bir sunucuya
 * (ya da yerel bir köprüye) çevrilebilir.
 */
const BASE = import.meta.env.VITE_API_BASE ?? "/api";

export class ApiError extends Error {
  status: number;
  code: string | null;
  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const KEY_STORAGE = "mp.key";
export const appKey = {
  get: () => {
    try {
      return localStorage.getItem(KEY_STORAGE) ?? "";
    } catch {
      return "";
    }
  },
  set: (v: string) => {
    try {
      if (v) localStorage.setItem(KEY_STORAGE, v);
      else localStorage.removeItem(KEY_STORAGE);
    } catch {
      /* yok say */
    }
  },
};

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    const key = appKey.get();
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(key ? { "x-app-key": key } : {}), ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "Sunucuya ulaşılamıyor. API çalışıyor mu?");
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
  if (!res.ok) throw new ApiError(res.status, body?.error ?? `Hata ${res.status}`, body?.code ?? null);
  return body as T;
}

export interface TaskApi {
  meta(): Promise<ServerMeta>;
  tasks(fresh?: boolean): Promise<{ tasks: Task[]; syncedAt: string }>;
  create(input: TaskInput): Promise<Task>;
  update(id: string, patch: TaskPatch): Promise<Task>;
  remove(id: string): Promise<void>;
}

/** Varsayılan: Hono sunucusu üzerinden (/api). */
export const httpApi: TaskApi = {
  meta: () => http<ServerMeta>("/meta"),
  tasks: (fresh = false) => http<{ tasks: Task[]; syncedAt: string }>(`/tasks${fresh ? "?fresh=1" : ""}`),
  create: (input: TaskInput) => http<Task>("/tasks", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, patch: TaskPatch) => http<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id: string) => http<void>(`/tasks/${id}`, { method: "DELETE" }),
};

/** Hangi veri katmanı? Derleme zamanında seçilir (bkz. data/index.ts). */
export type ApiMode = "http" | "mcp" | "local";
export const API_MODE: ApiMode = import.meta.env.VITE_API_MODE === "mcp" ? "mcp" : import.meta.env.VITE_API_MODE === "local" ? "local" : "http";
