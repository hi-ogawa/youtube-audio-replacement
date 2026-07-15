import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../styles.css";
import { FakeVideo } from "./ui-preview.tsx";
import { Panel } from "./ui.tsx";

let root: Root | undefined;

afterEach(() => {
  root?.unmount();
  root = undefined;
  document.body.replaceChildren();
});

test("selects, enables, adjusts, and replaces audio", async () => {
  const video = new FakeVideo();
  const onSelectAudio = vi.fn();
  const container = document.createElement("div");
  container.className =
    "flex min-h-screen items-start justify-center bg-button p-8 font-sans text-foreground";
  document.body.append(container);
  root = createRoot(container);
  root.render(
    <QueryClientProvider client={new QueryClient()}>
      <Panel
        videoId="trace-preview"
        getVideo={() => video}
        initialSelectedAudio={null}
        onSelectAudio={onSelectAudio}
        onError={vi.fn()}
      />
    </QueryClientProvider>,
  );

  const panel = page.elementLocator(container);
  const toggle = panel.getByRole("switch", {
    name: "Use replacement audio",
  });
  await expect.element(toggle).toBeDisabled();
  await page.mark("empty panel");

  const fileInput =
    container.querySelector<HTMLInputElement>('input[type="file"]');
  expect(fileInput).not.toBeNull();
  await userEvent.upload(fileInput!, "./fixtures/sine-2s.wav");

  await expect.element(panel.getByText("sine-2s.wav")).toBeVisible();
  await expect.element(toggle).toBeEnabled();
  await page.mark("audio selected");

  await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-checked", "true");
  expect(video.muted).toBe(true);
  await page.mark("replacement enabled");

  const volume = panel.getByLabelText("Replacement audio volume");
  await volume.click();
  await userEvent.keyboard("{Home}{ArrowRight>35/}");
  await expect.element(panel.getByText("35%")).toBeVisible();
  await page.mark("volume adjusted");

  const replacement = new File(["replacement"], "replacement.wav", {
    type: "audio/wav",
  });
  await userEvent.upload(fileInput!, replacement);

  await expect.element(panel.getByText("replacement.wav")).toBeVisible();
  await expect.element(toggle).toHaveAttribute("aria-checked", "false");
  expect(video.muted).toBe(false);
  expect(onSelectAudio).toHaveBeenCalledTimes(2);
  await page.mark("audio replaced and disabled");
});
