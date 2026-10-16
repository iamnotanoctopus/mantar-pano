import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./app/App";
import { PrefsProvider } from "./state/prefs";
import { ToastProvider } from "./components/Toast";
import { ApiError } from "./data/http";
// Başlıklar Fraunces (opsz ekseniyle); arayüz metni sistem yazı tipi (SF Pro / Segoe UI / system-ui).
import "@fontsource-variable/fraunces/full.css";
import "./styles/base.css";
import "./styles/themes/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnReconnect: true,
      // 4xx (şifre, doğrulama, bulunamadı) tekrar denemekle düzelmez; ağ/5xx için bir kez dene.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PrefsProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </PrefsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
