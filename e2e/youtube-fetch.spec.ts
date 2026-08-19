import path from "node:path";
import { chromium, expect, test } from "@playwright/test";
import { createCheckpoint } from "./helpers.ts";

test("loads a YouTube audio source", async () => {
  const checkpoint = createCheckpoint();
  const extensionPath = path.resolve("dist/extension");
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  await using disposables = new AsyncDisposableStack();
  disposables.defer(() => context.close());

  const serviceWorker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  checkpoint("service worker ready");
  const extensionId = new URL(serviceWorker.url()).host;
  const generator = await context.newPage();
  await generator.goto(`chrome-extension://${extensionId}/index.html`, {
    waitUntil: "domcontentloaded",
  });
  checkpoint("generator loaded");

  await generator
    .getByRole("textbox", { name: "YouTube video ID or URL" })
    .fill("7GU_VQfgMT0");
  await generator.getByRole("button", { name: "Load from YouTube" }).click();
  checkpoint("load submitted");

  await expect(generator.getByText("3.5 MB", { exact: false })).toBeVisible();
  checkpoint("source ready");
  await expect(
    generator.getByRole("button", { name: "Save source audio" }),
  ).toBeVisible();
  await expect(generator.getByRole("alert")).toHaveCount(0);
});
