/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_API_MODE?: "http" | "mcp" | "local";
  readonly VITE_NOTION_DATA_SOURCE_ID?: string;
  readonly VITE_NOTION_VIEW_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
