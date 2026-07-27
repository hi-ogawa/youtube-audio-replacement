import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright/story",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:5173/playwright/story/index.html",
    serviceWorkers: "block",
    reuseContext: true,
  },
  webServer: {
    command: "pnpm ui-preview",
    url: "http://localhost:5173/playwright/story/index.html",
    reuseExistingServer: !process.env.CI,
  },
});
