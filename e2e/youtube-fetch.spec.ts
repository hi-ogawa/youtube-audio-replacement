import path from "node:path";
import { chromium, expect, test } from "@playwright/test";

test("loads a YouTube audio source", async () => {
  test.setTimeout(90_000);
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
  const extensionId = new URL(serviceWorker.url()).host;
  const generator = await context.newPage();
  await generator.goto(`chrome-extension://${extensionId}/index.html`, {
    waitUntil: "domcontentloaded",
  });

  await generator
    .getByRole("textbox", { name: "YouTube video ID or URL" })
    .fill("7GU_VQfgMT0");
  await generator.getByRole("button", { name: "Load from YouTube" }).click();

  await expect(generator.getByText("3.5 MB", { exact: false })).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    generator.getByRole("button", { name: "Save source audio" }),
  ).toBeVisible();
  await expect(generator.getByRole("alert")).toHaveCount(0);
});
