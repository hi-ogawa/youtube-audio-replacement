import "./styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import JSZip from "jszip";
import { expect, onTestFinished, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { videoStorage } from "../lib/storage.ts";
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
          getVideo={() => video}
          initialSelectedAudio={undefined}
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

  const volume = screen.getByLabelText("Sine-2s volume");
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

test("imports and mixes every audio file in a ZIP", async () => {
  const video = new FakeVideo();
  const onSelectAudio = vi.fn();
  const screen = await render(
    <div className="flex min-h-screen items-start justify-center bg-button p-8 font-sans text-foreground">
      <QueryClientProvider client={new QueryClient()}>
        <Panel
          videoId="zip-preview"
          getVideo={() => video}
          initialSelectedAudio={undefined}
          onSelectAudio={onSelectAudio}
          onGenerate={vi.fn()}
          onError={vi.fn()}
        />
      </QueryClientProvider>
    </div>,
  );

  const zip = new JSZip();
  zip.file("stems/vocals.wav", "vocals");
  zip.file("stems/drums.wav", "drums");
  zip.file("stems/bass.wav", "bass");
  zip.file("stems/other.wav", "other");
  const file = new File(
    [await zip.generateAsync({ type: "blob" })],
    "song.stems.zip",
    {
      type: "application/zip",
    },
  );
  await userEvent.upload(screen.getByLabelText("Replacement audio file"), file);

  await expect.element(screen.getByText("song.stems.zip")).toBeVisible();
  expect(document.body.textContent).not.toContain("4 tracks");
  const vocalsVolume = screen.getByLabelText("Vocals volume");
  await expect.element(vocalsVolume).toBeDisabled();
  await expect.element(screen.getByLabelText("Drums volume")).toBeVisible();
  await expect.element(screen.getByLabelText("Bass volume")).toBeVisible();
  await expect.element(screen.getByLabelText("Other volume")).toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: "Mute Vocals" }))
    .toBeDisabled();
  await page.mark("stem mixer inactive");

  await screen.getByRole("switch", { name: "Use replacement audio" }).click();
  await expect.element(vocalsVolume).toBeEnabled();
  await page.mark("stem mixer active");

  const muteVocals = screen.getByRole("button", { name: "Mute Vocals" });
  await muteVocals.click();
  await expect.element(muteVocals).toHaveAttribute("aria-pressed", "true");

  const soloBass = screen.getByRole("button", { name: "Solo Bass" });
  const soloDrums = screen.getByRole("button", { name: "Solo Drums" });
  await soloBass.click();
  await soloDrums.click();
  await expect.element(soloBass).toHaveAttribute("aria-pressed", "true");
  await expect.element(soloDrums).toHaveAttribute("aria-pressed", "true");
  expect(videoStorage.getState("zip-preview").mixer).toMatchObject({
    "stems/vocals.wav": { muted: true },
    "stems/drums.wav": { soloed: true },
    "stems/bass.wav": { soloed: true },
  });

  expect(onSelectAudio).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "song.stems.zip",
      tracks: [
        expect.objectContaining({ name: "stems/vocals.wav" }),
        expect.objectContaining({ name: "stems/drums.wav" }),
        expect.objectContaining({ name: "stems/bass.wav" }),
        expect.objectContaining({ name: "stems/other.wav" }),
      ],
    }),
  );
});

test("dark mixer preview", async () => {
  document.documentElement.classList.add("dark");
  onTestFinished(() => {
    document.documentElement.classList.remove("dark");
  });
  const screen = await render(
    <div className="flex min-h-screen items-start justify-center bg-button p-8 font-sans text-foreground">
      <QueryClientProvider client={new QueryClient()}>
        <Panel
          videoId="dark-preview"
          getVideo={() => new FakeVideo()}
          initialSelectedAudio={{
            videoId: "dark-preview",
            name: "song.stems.zip",
            tracks: ["vocals", "drums", "bass", "other"].map((name) => ({
              name: `${name}.wav`,
              blob: new Blob(),
            })),
          }}
          onSelectAudio={vi.fn()}
          onGenerate={vi.fn()}
          onError={vi.fn()}
        />
      </QueryClientProvider>
    </div>,
  );

  await page.mark("stem mixer inactive dark");
  await screen.getByRole("switch", { name: "Use replacement audio" }).click();
  await page.mark("stem mixer active dark");
});

test("imports multiple audio files", async () => {
  const screen = await render(
    <div className="flex min-h-screen items-start justify-center bg-button p-8 font-sans text-foreground">
      <QueryClientProvider client={new QueryClient()}>
        <Panel
          videoId="multi-file-preview"
          getVideo={() => new FakeVideo()}
          initialSelectedAudio={undefined}
          onSelectAudio={vi.fn()}
          onGenerate={vi.fn()}
          onError={vi.fn()}
        />
      </QueryClientProvider>
    </div>,
  );

  const files = ["vocals", "drums", "bass", "other"].map(
    (name) => new File([name], `${name}.wav`, { type: "audio/wav" }),
  );
  await userEvent.upload(
    screen.getByLabelText("Replacement audio file"),
    files,
  );

  await expect.element(screen.getByLabelText("Other volume")).toBeVisible();
  await page.mark("multiple audio files");
});
