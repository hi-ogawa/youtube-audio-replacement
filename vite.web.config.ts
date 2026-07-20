import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    include: ["src/**/*.browser.test.tsx"],
    reporters: [["html", { singleFile: true }], ...configDefaults.reporters],
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: { channel: "chromium" },
      }),
      instances: [{ browser: "chromium" }],
      headless: true,
      traceView: true,
      viewport: { width: 800, height: 480 },
    },
  },
});
