import "./styles.css";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { ExtensionPagePreview } from "./extension-page-preview.tsx";

test("generator page", async () => {
  const screen = await render(<ExtensionPagePreview />);

  await expect
    .element(screen.getByRole("heading", { name: "Stem generator" }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("heading", { name: "1. Choose audio" }))
    .toBeVisible();
  await page.mark("extension page generator");
});

test("saved videos page", async () => {
  const screen = await render(<ExtensionPagePreview initialView="saved" />);

  await expect
    .element(screen.getByRole("heading", { name: "Saved videos" }))
    .toBeVisible();
  await expect
    .element(screen.getByText("3 videos using 57.6 MB"))
    .toBeVisible();
  await page.mark("extension page saved videos");
});

test("empty saved videos page", async () => {
  const screen = await render(
    <ExtensionPagePreview initialView="saved" emptySavedVideos />,
  );

  await expect.element(screen.getByText("No saved videos yet")).toBeVisible();
  await page.mark("extension page saved videos empty");
});
