import "./styles.css";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { ExtensionPageView } from "./extension-page.tsx";

test("generator page", async () => {
  const screen = await render(
    <ExtensionPageView view="generator" onViewChange={vi.fn()}>
      <div className="rounded-xl border border-border bg-panel p-6 shadow-sm">
        Generator content
      </div>
    </ExtensionPageView>,
  );

  await expect
    .element(screen.getByRole("heading", { name: "Stem generator" }))
    .toBeVisible();
  await expect.element(screen.getByText("Generator content")).toBeVisible();
  await page.mark("extension page generator");
});

test("saved videos page", async () => {
  const screen = await render(
    <ExtensionPageView view="saved" onViewChange={vi.fn()}>
      <div className="rounded-xl border border-dashed border-button-border bg-panel px-6 py-14 text-center shadow-sm">
        Saved videos content
      </div>
    </ExtensionPageView>,
  );

  await expect
    .element(screen.getByRole("heading", { name: "Saved videos" }))
    .toBeVisible();
  await expect.element(screen.getByText("Saved videos content")).toBeVisible();
  await page.mark("extension page saved videos");
});
