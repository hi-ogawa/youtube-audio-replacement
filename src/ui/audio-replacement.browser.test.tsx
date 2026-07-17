import "./styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { Panel } from "./audio-replacement.tsx";
import { FakeVideo } from "./preview.tsx";

test("basic", async () => {
  const video = new FakeVideo();
  const onSelectAudio = vi.fn();
  const screen = await render(
    <div className="flex min-h-screen items-start justify-center bg-button p-8 font-sans text-foreground">
      <QueryClientProvider client={new QueryClient()}>
        <Panel
          videoId="trace-preview"
          videoTitle="Trace preview"
          getVideo={() => video}
          initialSelectedAudio={null}
          onSelectAudio={onSelectAudio}
          onGenerate={vi.fn()}
          onError={vi.fn()}
        />
      </QueryClientProvider>
    </div>,
  );

  await expect
    .element(screen.getByRole("button", { name: "Prepare stems" }))
    .toBeVisible();
  await page.mark("empty panel");

  const fileInput = screen.getByLabelText("Replacement audio file");
  await userEvent.upload(fileInput, "./fixtures/sine-2s.wav");

  await expect.element(screen.getByText("sine-2s.wav")).toBeVisible();
  const toggle = screen.getByRole("switch", {
    name: "Use replacement audio",
  });
  await expect.element(toggle).toBeEnabled();
  await page.mark("audio selected");

  await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-checked", "true");
  expect(video.muted).toBe(true);
  await page.mark("replacement enabled");

  const volume = screen.getByLabelText("Replacement audio volume");
  await volume.click();
  await userEvent.keyboard("{Home}{ArrowRight>35/}");
  await expect.element(screen.getByText("35%")).toBeVisible();
  await page.mark("volume adjusted");

  const replacement = new File(["replacement"], "replacement.wav", {
    type: "audio/wav",
  });
  await userEvent.upload(fileInput!, replacement);

  await expect.element(screen.getByText("replacement.wav")).toBeVisible();
  await expect.element(toggle).toHaveAttribute("aria-checked", "false");
  expect(video.muted).toBe(false);
  expect(onSelectAudio).toHaveBeenCalledTimes(2);
  await page.mark("audio replaced and disabled");
});
