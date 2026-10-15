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
} from "../../shared/types.ts";
import { HttpError, validatePatch, type TaskRepo } from "./repo.ts";

/** Notion'daki özellik adları — "Görevlerim" veri kaynağıyla birebir. */
const P = {
  title: "Görev",
  area: "Alan",
  status: "Durum",
  priority: "Öncelik",
  date: "Tarih",
  duration: "Süre (dk)",
  note: "Not",
  day: "Gün",
} as const;

const NOTION_API = "https://api.notion.com/v1";
const TASKS_TTL_MS = 20_000; // istemci her yenilediğinde Notion'u yormamak için kısa önbellek
const SCHEMA_TTL_MS = 10 * 60_000;

interface NotionRepoOptions {
  token: string;
  dataSourceId?: string;
  databaseId?: string;
  version?: string;
}

/* ---------- Notion JSON tipleri (yalnızca kullandığımız kısımlar) ---------- */

interface RichText {
  plain_text: string;
}
interface NotionPage {
  id: string;
  url?: string;
  created_time: string;
  last_edited_time: string;
  archived?: boolean;
  in_trash?: boolean;
  properties: Record<string, NotionProp>;
}
interface NotionProp {
  type: string;
  title?: RichText[];
  rich_text?: RichText[];
  select?: { name: string; color: NotionColor } | null;
  status?: { name: string; color: NotionColor } | null;
  date?: { start: string; end: string | null } | null;
  number?: number | null;
  formula?: { type: string; string?: string | null; number?: number | null; date?: { start: string } | null };
}
interface NotionDataSource {
  id: string;
  title?: RichText[];
  parent?: { type: string; database_id?: string };
  properties: Record<
    string,
    {
      type: string;
      select?: { options: { id: string; name: string; color: NotionColor }[] };
      status?: {
        options: { id: string; name: string; color: NotionColor }[];
        groups: { id: string; name: string; color: NotionColor; option_ids: string[] }[];
      };
    }
  >;
}

const text = (rt?: RichText[] | null) => (rt ?? []).map((r) => r.plain_text).join("");
const dateOnly = (s: string | null | undefined) => (s ? s.slice(0, 10) : null);

/** Notion rich text parçaları en fazla 2000 karakter olabilir. */
function toRichText(s: string) {
  const chunks: { type: "text"; text: { content: string } }[] = [];
  for (let i = 0; i < s.length; i += 2000) {
    chunks.push({ type: "text", text: { content: s.slice(i, i + 2000) } });
  }
  return chunks;
}

function groupKey(name: string): StatusGroup {
  const n = name.toLowerCase();
  if (n.includes("progress")) return "in_progress";
  if (n.includes("complete") || n.includes("done")) return "complete";
  return "to_do";
}

export class NotionRepo implements TaskRepo {
  private token: string;
  private version: string;
  private dataSourceId: string | null;
  private databaseId: string | null;

  private schemaCache: { schema: Schema; title: string; notionUrl: string | null; at: number } | null = null;
  private tasksCache: { tasks: Task[]; at: number } | null = null;
  private inflight: Promise<Task[]> | null = null;
  private lastSyncAt: string | null = null;

  constructor(opts: NotionRepoOptions) {
    this.token = opts.token;
    this.version = opts.version ?? "2025-09-03";
    this.dataSourceId = opts.dataSourceId || null;
    this.databaseId = opts.databaseId || null;
  }

  /* ---------------------------- HTTP katmanı ---------------------------- */

  private async request<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
    const res = await fetch(`${NOTION_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Notion-Version": this.version,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (res.status === 429 && attempt < 3) {
      const wait = Number(res.headers.get("retry-after") ?? "1") * 1000;
      await new Promise((r) => setTimeout(r, Math.min(wait, 5000)));
      return this.request<T>(path, init, attempt + 1);
    }

    if (!res.ok) {
      let message = `Notion ${res.status}`;
      let code = "";
      try {
        const body = (await res.json()) as { message?: string; code?: string };
        message = body.message ?? message;
        code = body.code ?? "";
      } catch {
        /* gövde yok */
      }
      if (res.status === 401) message = "Notion token geçersiz ya da süresi dolmuş. (.env → NOTION_TOKEN)";
      if (res.status === 404)
        message =
          "Notion veri kaynağı bulunamadı. Entegrasyonu 'Mantar Pano' sayfasına bağladığından (Connections) ve NOTION_DATA_SOURCE_ID'nin doğru olduğundan emin ol.";
      if (res.status === 429) message = "Notion hız sınırına takıldı, birazdan tekrar dene.";
      const err = new HttpError(res.status >= 500 ? 502 : res.status, message);
      (err as HttpError & { code?: string }).code = code;
      throw err;
    }
    return (await res.json()) as T;
  }

  /* ------------------------------- Şema -------------------------------- */

  private async resolveDataSourceId(): Promise<string> {
    if (this.dataSourceId) return this.dataSourceId;
    if (!this.databaseId) throw new HttpError(500, "NOTION_DATA_SOURCE_ID ya da NOTION_DATABASE_ID tanımlı olmalı.");
    const db = await this.request<{ data_sources?: { id: string }[] }>(`/databases/${this.databaseId}`);
    const id = db.data_sources?.[0]?.id;
    if (!id) throw new HttpError(500, "Veritabanında veri kaynağı bulunamadı.");
    this.dataSourceId = id;
    return id;
  }

  private async loadSchema(force = false) {
    if (!force && this.schemaCache && Date.now() - this.schemaCache.at < SCHEMA_TTL_MS) return this.schemaCache;
    const id = await this.resolveDataSourceId();
    const ds = await this.request<NotionDataSource>(`/data_sources/${id}`);

    const areas = ds.properties[P.area]?.select?.options?.map((o) => ({ name: o.name, color: o.color })) ?? DEFAULT_SCHEMA.areas;
    const priorities =
      ds.properties[P.priority]?.select?.options?.map((o) => ({ name: o.name, color: o.color })) ?? DEFAULT_SCHEMA.priorities;

    const st = ds.properties[P.status]?.status;
    let statuses = DEFAULT_SCHEMA.statuses;
    if (st?.options?.length) {
      const groupOf = new Map<string, StatusGroup>();
      for (const g of st.groups ?? []) for (const oid of g.option_ids) groupOf.set(oid, groupKey(g.name));
      statuses = st.options.map((o) => ({ name: o.name, color: o.color, group: groupOf.get(o.id) ?? "to_do" }));
    }

    const dbId = ds.parent?.type === "database_id" ? ds.parent.database_id : null;
    const notionUrl = dbId ? `https://www.notion.so/${dbId.replace(/-/g, "")}` : null;

    this.schemaCache = {
      schema: { areas, statuses, priorities },
      title: text(ds.title) || "Görevlerim",
      notionUrl,
      at: Date.now(),
    };
    return this.schemaCache;
  }

  async meta(): Promise<ServerMeta> {
    const s = await this.loadSchema();
    return {
      mode: "notion",
      dataSourceId: this.dataSourceId,
      dataSourceTitle: s.title,
      notionUrl: s.notionUrl,
      schema: s.schema,
      lastSyncAt: this.lastSyncAt,
    };
  }

  /* ------------------------------ Eşleme ------------------------------- */

  private pageToTask(p: NotionPage): Task {
    const pr = p.properties;
    const day = pr[P.day]?.formula;
    const dayLabel = day?.type === "string" ? (day.string ?? null) : day?.type === "number" ? String(day.number ?? "") : null;
    return {
      id: p.id.replace(/-/g, ""),
      title: text(pr[P.title]?.title),
      area: pr[P.area]?.select?.name ?? null,
      status: pr[P.status]?.status?.name ?? STATUS_TODO,
      priority: pr[P.priority]?.select?.name ?? null,
      date: dateOnly(pr[P.date]?.date?.start),
      dateEnd: dateOnly(pr[P.date]?.date?.end),
      duration: pr[P.duration]?.number ?? null,
      note: text(pr[P.note]?.rich_text),
      dayLabel,
      url: p.url ?? `https://www.notion.so/${p.id.replace(/-/g, "")}`,
      createdTime: p.created_time,
      lastEditedTime: p.last_edited_time,
    };
  }

  private toProperties(patch: TaskPatch, existing?: Task) {
    const props: Record<string, unknown> = {};
    if (patch.title !== undefined) props[P.title] = { title: toRichText(patch.title) };
    if (patch.area !== undefined) props[P.area] = { select: patch.area ? { name: patch.area } : null };
    if (patch.status !== undefined) props[P.status] = { status: { name: patch.status } };
    if (patch.priority !== undefined) props[P.priority] = { select: patch.priority ? { name: patch.priority } : null };
    if (patch.date !== undefined || patch.dateEnd !== undefined) {
      const start = patch.date !== undefined ? patch.date : (existing?.date ?? null);
      const end = patch.dateEnd !== undefined ? patch.dateEnd : (existing?.dateEnd ?? null);
      props[P.date] = start ? { date: { start, end: end && end > start ? end : null } } : { date: null };
    }
    if (patch.duration !== undefined) props[P.duration] = { number: patch.duration };
    if (patch.note !== undefined) props[P.note] = { rich_text: patch.note ? toRichText(patch.note) : [] };
    return props;
  }

  /* ------------------------------ Okuma -------------------------------- */

  async list(opts: { fresh?: boolean } = {}): Promise<Task[]> {
    if (!opts.fresh && this.tasksCache && Date.now() - this.tasksCache.at < TASKS_TTL_MS) return this.tasksCache.tasks;
    if (this.inflight) return this.inflight;

    this.inflight = (async () => {
      try {
        const id = await this.resolveDataSourceId();
        const tasks: Task[] = [];
        let cursor: string | undefined;
        do {
          const body: Record<string, unknown> = {
            page_size: 100,
            sorts: [{ property: P.date, direction: "ascending" }],
          };
          if (cursor) body.start_cursor = cursor;
          const page = await this.request<{ results: NotionPage[]; next_cursor: string | null; has_more: boolean }>(
            `/data_sources/${id}/query`,
            { method: "POST", body: JSON.stringify(body) },
          );
          for (const p of page.results) if (!p.archived && !p.in_trash) tasks.push(this.pageToTask(p));
          cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined;
        } while (cursor);

        this.tasksCache = { tasks, at: Date.now() };
        this.lastSyncAt = new Date().toISOString();
        return tasks;
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }

  /* ------------------------------ Yazma -------------------------------- */

  private upsertCache(task: Task) {
    if (!this.tasksCache) return;
    const i = this.tasksCache.tasks.findIndex((t) => t.id === task.id);
    if (i >= 0) this.tasksCache.tasks[i] = task;
    else this.tasksCache.tasks.push(task);
  }

  async create(input: TaskInput): Promise<Task> {
    const { schema } = await this.loadSchema();
    const p = validatePatch(input, schema, true);
    const id = await this.resolveDataSourceId();
    const page = await this.request<NotionPage>(`/pages`, {
      method: "POST",
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: id },
        properties: this.toProperties({ status: STATUS_TODO, ...p }),
      }),
    });
    const task = this.pageToTask(page);
    this.upsertCache(task);
    return task;
  }

  async update(id: string, patch: TaskPatch): Promise<Task> {
    const { schema } = await this.loadSchema();
    const p = validatePatch(patch, schema);
    if (p.title !== undefined && !p.title) delete p.title; // boş başlık yazma
    const existing = this.tasksCache?.tasks.find((t) => t.id === id);
    const page = await this.request<NotionPage>(`/pages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ properties: this.toProperties(p, existing) }),
    });
    const task = this.pageToTask(page);
    this.upsertCache(task);
    return task;
  }

  async archive(id: string): Promise<void> {
    try {
      await this.request(`/pages/${id}`, { method: "PATCH", body: JSON.stringify({ archived: true }) });
    } catch (e) {
      // Daha yeni API sürümlerinde alan adı in_trash olabilir.
      if (e instanceof HttpError && e.status === 400) {
        await this.request(`/pages/${id}`, { method: "PATCH", body: JSON.stringify({ in_trash: true }) });
      } else throw e;
    }
    if (this.tasksCache) this.tasksCache.tasks = this.tasksCache.tasks.filter((t) => t.id !== id);
  }
}
