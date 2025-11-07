import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/assets/styles/globals.css";
import App from "./App.tsx";
import { AppWrapper } from "@/components/layout/PageMeta";
import { isLocalMode } from "@/shared/config/database";
import { initLocalDatabase } from "@/shared/utils/initLocalDB";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import "@/shared/utils/fetchWrapper"; // 初始化fetch攔截器

// 初始化本地資料庫
if (isLocalMode) {
  initLocalDatabase().catch(console.error);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppWrapper>
        <App />
      </AppWrapper>
    </ErrorBoundary>
  </StrictMode>
);
