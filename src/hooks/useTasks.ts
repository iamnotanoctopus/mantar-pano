import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_SCHEMA, STATUS_TODO, type ServerMeta, type Task, type TaskInput, type TaskPatch } from "@shared/types";
import { API_MODE, api } from "@/data";
import { useToast } from "@/components/Toast";
import { linkStableKey } from "@/lib/stableKey";

const TASKS_KEY = ["tasks"] as const;
const META_KEY = ["meta"] as const;
const CACHE_KEY = "mp.tasks.cache";

interface TasksResult {
  tasks: Task[];
  syncedAt: string;
}

/* Son başarılı listeyi tarayıcıda sakla: açılışta anında boyansın, sonra tazelensin. */
function readCache(): TasksResult | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as TasksResult) : undefined;
  } catch {
    return undefined;
  }
}
function writeCache(v: TasksResult) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(v));
  } catch {
    /* depolama kapalı olabilir */
  }
}

export function useMeta() {
  return useQuery<ServerMeta>({
    queryKey: META_KEY,
    queryFn: api.meta,
    staleTime: 10 * 60_000,
  });
}

export function useSchema() {
  const { data } = useMeta();
  return data?.schema ?? DEFAULT_SCHEMA;
}

export function useTasks() {
  const cached = readCache();
  return useQuery<TasksResult>({
    queryKey: TASKS_KEY,
    queryFn: async () => {
      const r = await api.tasks();
      writeCache(r);
      return r;
    },
    initialData: cached,
    initialDataUpdatedAt: cached ? 0 : undefined, // önbellek var ama hemen tazelenmeli
    staleTime: 20_000,
    refetchInterval: API_MODE === "mcp" ? 120_000 : 60_000,
    refetchOnWindowFocus: true,
  });
}

/** Sunucudaki önbelleği de atlayarak Notion'dan taze çeker. */
export function useRefresh() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: () => api.tasks(true),
    onSuccess: (r) => {
      writeCache(r);
      qc.setQueryData(TASKS_KEY, r);
      void qc.invalidateQueries({ queryKey: META_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function patchList(qc: ReturnType<typeof useQueryClient>, fn: (tasks: Task[]) => Task[]) {
  qc.setQueryData<TasksResult>(TASKS_KEY, (old) => {
    const next = { tasks: fn(old?.tasks ?? []), syncedAt: old?.syncedAt ?? new Date().toISOString() };
    writeCache(next);
    return next;
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: TaskInput) => api.create(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const prev = qc.getQueryData<TasksResult>(TASKS_KEY);
      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();
      const optimistic: Task = {
        id: tempId,
        title: input.title,
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
      patchList(qc, (ts) => [...ts, optimistic]);
      return { prev, tempId };
    },
    onSuccess: (task, _input, ctx) => {
      if (ctx?.tempId) linkStableKey(task.id, ctx.tempId);
      patchList(qc, (ts) => ts.map((t) => (t.id === ctx?.tempId ? task : t)));
    },
    onError: (e: Error, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(TASKS_KEY, ctx.prev);
      toast.error(`Kart eklenemedi: ${e.message}`);
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaskPatch }) => api.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const prev = qc.getQueryData<TasksResult>(TASKS_KEY);
      patchList(qc, (ts) => ts.map((t) => (t.id === id ? ({ ...t, ...patch, lastEditedTime: new Date().toISOString() } as Task) : t)));
      return { prev };
    },
    onSuccess: (task) => {
      patchList(qc, (ts) => ts.map((t) => (t.id === task.id ? task : t)));
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(TASKS_KEY, ctx.prev);
      toast.error(`Kaydedilemedi: ${e.message}`);
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => api.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const prev = qc.getQueryData<TasksResult>(TASKS_KEY);
      patchList(qc, (ts) => ts.filter((t) => t.id !== id));
      return { prev };
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(TASKS_KEY, ctx.prev);
      toast.error(`Silinemedi: ${e.message}`);
    },
    onSuccess: () => toast.info("Kart panodan kaldırıldı."),
  });
}
