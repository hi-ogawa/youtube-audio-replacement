import "./styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PreviewApp } from "./preview.tsx";

function main() {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Root element not found");
  }

  const queryClient = new QueryClient();
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <PreviewApp />
      </QueryClientProvider>
    </StrictMode>,
  );
}

main();
