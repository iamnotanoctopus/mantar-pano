/**
 * Veri katmanı seçimi — derleme zamanında VITE_API_MODE ile:
 *   local → tarayıcıda localStorage (statik yayın / GitHub Pages / çevrimdışı)
 *   http  → Hono sunucusu üzerinden Notion API (kendi sunucun)
 *   mcp   → claude.ai artifact içinde görüntüleyenin Notion bağlayıcısı
 */
import { API_MODE, httpApi, type TaskApi } from "./http";
import { localApi } from "./local";
import { mcpApi } from "./mcpNotion";

export const api: TaskApi = API_MODE === "mcp" ? mcpApi : API_MODE === "local" ? localApi : httpApi;
export { API_MODE, localApi };
