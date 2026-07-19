import path from "node:path";
import { chromium, expect, test } from "@playwright/test";

test("stores replacement audio and survives YouTube navigation", async () => {
  const extensionPath = path.resolve("dist/extension");

  await using disposables = new AsyncDisposableStack();
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  disposables.defer(() => context.close());

  const page = await context.newPage();
  await page.goto("https://www.youtube.com/watch?v=7GU_VQfgMT0", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  const host = page.locator("#youtube-audio-replacement-host");
  await expect(host).toBeAttached({ timeout: 15_000 });
  await host.getByRole("button", { name: "Show stem mixer controls" }).click();
  await expect(host.getByText("Stem mixer", { exact: true })).toBeVisible();

  await host
    .locator('input[type="file"]')
    .setInputFiles(path.resolve("fixtures/sine-2s.wav"));
  await expect(host.getByText("sine-2s.wav", { exact: true })).toBeVisible();
  await expect
    .poll(() => {
      const storageFrame = page
        .frames()
        .find((frame) => frame.url().includes("src/extension-storage.html"));
      return storageFrame?.evaluate(() =>
        window.__e2e?.audioStorage.loadAudio("7GU_VQfgMT0"),
      );
    })
    .toMatchObject({
      name: "sine-2s.wav",
      videoMetadata: {
        title: expect.any(String),
        channelName: expect.any(String),
      },
      savedAt: expect.any(Number),
    });

  await page.evaluate(() => {
    document.dispatchEvent(new Event("yt-navigate-start"));
    history.pushState({}, "", "/watch?v=spa-navigation-test");
    document.dispatchEvent(new Event("yt-navigate-finish"));
  });
  await expect(host).toBeAttached();
  await expect(
    host.getByRole("button", { name: "Show stem mixer controls" }),
  ).toBeVisible();
});
