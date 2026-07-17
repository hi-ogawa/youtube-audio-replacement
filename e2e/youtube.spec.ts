import path from "node:path";
import { chromium, expect, test } from "@playwright/test";

test("stores replacement audio, lists it, and survives YouTube navigation", async () => {
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
        .find((frame) => frame.url().includes("src/storage.html"));
      return storageFrame?.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("youtube-audio-replacement", 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        return new Promise<string | undefined>((resolve, reject) => {
          const request = database
            .transaction("audio", "readonly")
            .objectStore("audio")
            .get("7GU_VQfgMT0");
          request.onsuccess = () => resolve(request.result?.name);
          request.onerror = () => reject(request.error);
        });
      });
    })
    .toBe("sine-2s.wav");

  const generatorPromise = context.waitForEvent("page");
  await host.getByRole("button", { name: "Prepare stems" }).click();
  const generator = await generatorPromise;
  await generator.getByRole("button", { name: "Saved videos" }).click();
  await expect(
    generator.getByText("sine-2s.wav", { exact: false }),
  ).toBeVisible({
    timeout: 15_000,
  });
  await generator.close();

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
