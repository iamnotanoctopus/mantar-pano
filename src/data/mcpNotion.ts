/**
 * Sunucusuz veri katmanı: sayfa claude.ai içinde yayımlandığında, görüntüleyenin
 * kendi Notion bağlayıcısını `claude.use("mcp")` üzerinden çağırır. Token sayfaya
 * hiç inmez; her çağrı görüntüleyenin yetkisiyle çalışır.
 *
 * Kullanılan Notion araçları (manifestte de aynı adlarla bildirilir):
 *   notion-fetch               → şema (Alan / Durum / Öncelik seçenekleri)
 *   notion-query-data-sources  → kart listesi (kaynak veritabanının filtresiz görünümü)
 *   notion-create-pages        → yeni kart
 *   notion-update-page         → kart düzenleme
 *   notion-delete-pages        → kartı çöp kutusuna taşıma
 */
import {
  DEFAULT_SCHEMA,
  STATUS_TODO,
  type NotionColor,
  type Schema,
  type ServerMeta,
  type StatusGroup,
  type Task,
  type TaskInput,
  type TaskPatch,
} from "@shared/types";
import { ApiError } from "./http";

const SERVER = "Notion";
const DATA_SOURCE_ID = import.meta.env.VITE_NOTION_DATA_SOURCE_ID ?? "0afa34c2-9951-4a1b-9306-d2958d720bdf";
/** Kaynak veritabanının filtresiz "Default view" görünümü — tüm kartlar, sayfalı. */
const VIEW_URL =
  import.meta.env.VITE_NOTION_VIEW_URL ??
  "https://app.notion.com/p/162646dea4a64bd180d164311a3406f2?v=f204f96b-4355-4238-9062-b3540194ea09";

/** Notion'daki özellik adları — "Görevlerim" ile birebir. */
const P = {
  title: "Görev",
  area: "Alan",
  status: "Durum",
  priority: "Öncelik",
  dateStart: "date:Tarih:start",
  dateEnd: "date:Tarih:end",
  dateIsDatetime: "date:Tarih:is_datetime",
  duration: "Süre (dk)",
  note: "Not",
} as const;

/* ------------------------------------------------------------------ MCP */

interface McpError {
  code?: string;
  message?: string;
  server?: string;
  result?: unknown;
}
interface CallResult {
  payload?: unknown;
  content?: { type: string; text?: string }[];
}
interface McpNs {
  callTool(server: string, tool: string, input?: unknown, options?: unknown): Promise<CallResult>;
}

let nsPromise: Promise<McpNs | null> | null = null;

function mcp(): Promise<McpNs | null> {
  if (!nsPromise) {
    const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
    nsPromise = c?.use ? (c.use("mcp") as Promise<McpNs | null>).catch(() => null) : Promise.resolve(null);
  }
  return nsPromise;
}

const MESSAGES: Record<string, string> = {
  needs_reauth: "Notion bağlantısının süresi dolmuş. claude.ai → Ayarlar → Bağlayıcılar'dan Notion'u yeniden bağla.",
  server_not_connected: "Notion bağlayıcısı ekli değil. claude.ai → Ayarlar → Bağlayıcılar'dan Notion'u ekle.",
  selection_required: "Birden fazla Notion bağlantısı var; claude.ai'nin sorduğu seçimde birini seç.",
  not_in_manifest: "Bu sayfanın Notion'a erişmesine izin verilmedi. Sayfanın izinler menüsünden Notion'u aç.",
  approval_required: "Notion erişimi için onay gerekiyor. claude.ai'nin sorduğu izni ver, sonra yenile.",
  consent_required: "Notion erişimi için onay gerekiyor. İzni verip tekrar dene.",
  blocked_by_policy: "Notion aracı kuruluş politikasıyla engellenmiş.",
  server_unavailable: "Notion şu an yanıt vermiyor; birazdan tekrar dene.",
  rate_limited: "Çok sık istek gitti; birkaç saniye sonra tekrar dene.",
  not_granted: "Bu görünümde Notion bağlayıcısı kullanılamıyor.",
  capability_disabled: "Bu görünümde Notion bağlayıcısı kullanılamıyor.",
};

function toApiError(e: unknown): ApiError {
  const err = (e ?? {}) as McpError;
  const code = err.code ?? "upstream_error";
  let message = MESSAGES[code];
  if (!message) {
    if (code === "tool_error") {
      const raw = err.message ?? "";
      try {
        const parsed = JSON.parse(raw) as { message?: string; error?: { message?: string } };
        message = `Notion: ${parsed.message ?? parsed.error?.message ?? raw}`;
      } catch {
        message = `Notion: ${raw || "işlem başarısız"}`;
      }
    } else message = err.message ? `Notion: ${err.message}` : "Notion'a ulaşılamadı.";
  }
  return new ApiError(code === "needs_reauth" || code === "server_not_connected" ? 503 : 502, message, code);
}

async function call<T = unknown>(tool: string, input: unknown, opts?: unknown): Promise<T> {
  const ns = await mcp();
  if (!ns) throw new ApiError(0, "Bu sayfa Notion'a yalnızca claude.ai içinde açıldığında bağlanır. Bağlantıyı Claude uygulamasından aç.", "no_mcp");
  try {
    const res = await ns.callTool(SERVER, tool, input, opts);
    return (res.payload ?? parseFirstText(res)) as T;
  } catch (e) {
    throw toApiError(e);
  }
}

function parseFirstText(res: CallResult): unknown {
  const text = res.content?.find((b) => b.type === "text")?.text;
  if (text === undefined) return res;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/* ---------------------------------------------------------------- Eşleme */

type Row = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const opt = (v: unknown) => (typeof v === "string" && v ? v : null);
const idFromUrl = (url: string) => {
  const m = url.match(/([0-9a-f]{32})(?:\?|$)/i);
  return m ? m[1] : url;
};

function rowToTask(r: Row, prev?: Task): Task {
  const url = str(r.url);
  return {
    id: idFromUrl(url),
    title: str(r[P.title]),
    area: opt(r[P.area]),
    status: opt(r[P.status]) ?? STATUS_TODO,
    priority: opt(r[P.priority]),
    date: opt(r[P.dateStart])?.slice(0, 10) ?? null,
    dateEnd: opt(r[P.dateEnd])?.slice(0, 10) ?? null,
    duration: num(r[P.duration]),
    note: str(r[P.note]),
    dayLabel: null,
    url: url.replace("app.notion.com", "www.notion.so"),
    createdTime: prev?.createdTime ?? str(r.createdTime) ?? "",
    lastEditedTime: prev?.lastEditedTime ?? "",
  };
}

function toProperties(patch: TaskPatch): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  if (patch.title !== undefined) props[P.title] = patch.title;
  if (patch.area !== undefined) props[P.area] = patch.area;
  if (patch.status !== undefined) props[P.status] = patch.status;
  if (patch.priority !== undefined) props[P.priority] = patch.priority;
  if (patch.date !== undefined) {
    props[P.dateStart] = patch.date;
    props[P.dateEnd] = patch.date ? (patch.dateEnd ?? null) : null;
    if (patch.date) props[P.dateIsDatetime] = 0;
  } else if (patch.dateEnd !== undefined) {
    props[P.dateEnd] = patch.dateEnd;
  }
  if (patch.duration !== undefined) props[P.duration] = patch.duration;
  if (patch.note !== undefined) props[P.note] = patch.note;
  return props;
}

/* ------------------------------------------------------------------ Şema */

interface DataSourceState {
  name?: string;
  schema?: Record<
    string,
    {
      type: string;
      options?: { name: string; color: NotionColor }[];
      groups?: Partial<Record<"to_do" | "in_progress" | "complete" | "current" | "future", { name: string; color: NotionColor }[]>>;
    }
  >;
}

function parseSchema(text: string): { schema: Schema; title: string } {
  const m = text.match(/<data-source-state>\s*([\s\S]*?)\s*<\/data-source-state>/);
  if (!m) return { schema: DEFAULT_SCHEMA, title: "Görevlerim" };
  try {
    const st = JSON.parse(m[1]) as DataSourceState;
    const s = st.schema ?? {};
    const sel = (name: string) => s[name]?.options?.map((o) => ({ name: o.name, color: o.color }));
    const statuses = (() => {
      const g = s[P.status]?.groups;
      if (!g) return undefined;
      const out: Schema["statuses"] = [];
      const push = (list: { name: string; color: NotionColor }[] | undefined, group: StatusGroup) =>
        list?.forEach((o) => out.push({ name: o.name, color: o.color, group }));
      push(g.to_do, "to_do");
      push(g.in_progress, "in_progress");
      push(g.current, "in_progress");
      push(g.future, "to_do");
      push(g.complete, "complete");
      return out.length ? out : undefined;
    })();
    return {
      title: st.name ?? "Görevlerim",
      schema: {
        areas: sel(P.area) ?? DEFAULT_SCHEMA.areas,
        statuses: statuses ?? DEFAULT_SCHEMA.statuses,
        priorities: sel(P.priority) ?? DEFAULT_SCHEMA.priorities,
      },
    };
  } catch {
    return { schema: DEFAULT_SCHEMA, title: "Görevlerim" };
  }
}

/* ----------------------------------------------------------------- API */

let lastTasks = new Map<string, Task>();
let lastSyncAt: string | null = null;

async function listAll(): Promise<Task[]> {
  const out: Task[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const data: Record<string, unknown> = { mode: "view", view_url: VIEW_URL, page_size: 100, is_archived: false };
    if (cursor) data.start_cursor = cursor;
    const res = await call<{ results?: Row[]; has_more?: boolean; next_cursor?: string | null }>("notion-query-data-sources", { data }, { cache: false });
    for (const r of res.results ?? []) {
      const t = rowToTask(r, lastTasks.get(idFromUrl(str(r.url))));
      out.push(t);
    }
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  lastTasks = new Map(out.map((t) => [t.id, t]));
  lastSyncAt = new Date().toISOString();
  return out;
}

export const mcpApi = {
  async meta(): Promise<ServerMeta> {
    const res = await call<{ text?: string; url?: string; title?: string }>("notion-fetch", { id: `collection://${DATA_SOURCE_ID}` }, { cache: { staleTime: 300_000 } });
    const { schema, title } = parseSchema(res.text ?? "");
    return {
      mode: "notion",
      dataSourceId: DATA_SOURCE_ID,
      dataSourceTitle: res.title || title,
      notionUrl: res.url ? res.url.replace("app.notion.com", "www.notion.so").replace(/\?.*$/, "") : null,
      schema,
      lastSyncAt,
    };
  },

  async tasks(): Promise<{ tasks: Task[]; syncedAt: string }> {
    const tasks = await listAll();
    return { tasks, syncedAt: lastSyncAt ?? new Date().toISOString() };
  },

  async create(input: TaskInput): Promise<Task> {
    const before = new Set(lastTasks.keys());
    const props = toProperties({ status: STATUS_TODO, ...input });
    await call("notion-create-pages", {
      parent: { type: "data_source_id", data_source_id: DATA_SOURCE_ID },
      pages: [{ properties: props }],
      allow_async: false,
    });
    const tasks = await listAll();
    const created = tasks.find((t) => !before.has(t.id) && t.title === input.title.trim()) ?? tasks.find((t) => !before.has(t.id));
    if (!created) throw new ApiError(502, "Kart Notion'a yazıldı ama listede bulunamadı; yenilemeyi dene.", "not_found");
    created.createdTime = new Date().toISOString();
    lastTasks.set(created.id, created);
    return created;
  },

  async update(id: string, patch: TaskPatch): Promise<Task> {
    const props = toProperties(patch);
    if (Object.keys(props).length) {
      await call("notion-update-page", { page_id: id, command: "update_properties", properties: props, allow_async: false });
    }
    const prev = lastTasks.get(id);
    const next: Task = {
      ...(prev ?? { id, title: "", area: null, status: STATUS_TODO, priority: null, date: null, dateEnd: null, duration: null, note: "", dayLabel: null, url: null, createdTime: "" }),
      ...patch,
      id,
      lastEditedTime: new Date().toISOString(),
    } as Task;
    lastTasks.set(id, next);
    return next;
  },

  async remove(id: string): Promise<void> {
    await call("notion-delete-pages", { page_ids: [id], user_confirmed: true });
    lastTasks.delete(id);
  },
};
