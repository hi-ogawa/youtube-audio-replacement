import path from "node:path";
import { chromium, expect, test } from "@playwright/test";

test("stores replacement audio and survives YouTube navigation", async () => {
  const startedAt = Date.now();
  const checkpoint = (label: string) =>
    console.log(`[${Date.now() - startedAt}ms] ${label}`);

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

  const page = await context.newPage();
  await page.goto("https://www.youtube.com/watch?v=7GU_VQfgMT0", {
    waitUntil: "domcontentloaded",
  });
  checkpoint("initial navigation");

  const host = page.locator("#youtube-audio-replacement-host");
  await expect(host).toBeAttached();
  await host.getByRole("button", { name: "Show stem mixer controls" }).click();
  await expect(host.getByText("Stem mixer", { exact: true })).toBeVisible();
  checkpoint("mixer opened");

  const generatorPromise = context.waitForEvent("page");
  await host.getByRole("button", { name: "Prepare stems" }).click();
  const generator = await generatorPromise;

  await host
    .locator('input[type="file"]')
    .setInputFiles(path.resolve("fixtures/sine-2s.wav"));
  await expect(host.getByText("sine-2s.wav", { exact: true })).toBeVisible();
  checkpoint("file selected");
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
  checkpoint("extension storage verified");

  await generator.getByRole("button", { name: "Saved videos" }).click();
  await expect(
    generator.getByText("sine-2s.wav", { exact: false }),
  ).toBeVisible();
  await generator.close();

  await page.reload({
    waitUntil: "domcontentloaded",
  });
  checkpoint("page reloaded");

  const reloadedHost = page.locator("#youtube-audio-replacement-host");
  await expect(reloadedHost).toBeAttached();
  checkpoint("content UI remounted");

  await expect(
    reloadedHost.getByText("sine-2s.wav", { exact: true }),
  ).toBeVisible();
  checkpoint("stored audio restored");

  await page.evaluate(() => {
    document.dispatchEvent(new Event("yt-navigate-start"));
    history.pushState({}, "", "/watch?v=spa-navigation-test");
    document.dispatchEvent(new Event("yt-navigate-finish"));
  });
  await expect(reloadedHost).toBeAttached();
  await expect(
    reloadedHost.getByRole("button", { name: "Show stem mixer controls" }),
  ).toBeVisible();
});
