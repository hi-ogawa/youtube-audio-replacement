import "./styles.css";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { SavedVideosView } from "./saved-videos.tsx";

test("populated library", async () => {
  const screen = await render(
    <SavedVideosView
      videos={[
        {
          videoId: "YsmSk0cZa6w",
          videoMetadata: {
            title: "Bass cover with a deliberately long video title",
          },
          name: "bass-and-drums.zip",
          size: 38_400_000,
          savedAt: Date.UTC(2026, 6, 17),
        },
        {
          videoId: "7GU_VQfgMT0",
          videoMetadata: { title: "Live session rehearsal" },
          name: "vocals.wav",
          size: 12_800_000,
          savedAt: Date.UTC(2026, 6, 14),
        },
        {
          videoId: "fallback-id",
          name: "replacement-audio.wav",
          size: 6_400_000,
        },
      ]}
      loading={false}
      onDelete={vi.fn()}
    />,
  );

  await expect
    .element(screen.getByText("3 videos using 57.6 MB"))
    .toBeVisible();
  await expect
    .element(screen.getByText("Live session rehearsal"))
    .toBeVisible();
  await page.mark("saved videos populated");
});

test("empty library", async () => {
  const screen = await render(
    <SavedVideosView videos={[]} loading={false} onDelete={vi.fn()} />,
  );

  await expect.element(screen.getByText("No saved videos yet")).toBeVisible();
  await page.mark("saved videos empty");
});
