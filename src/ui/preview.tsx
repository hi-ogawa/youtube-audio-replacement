import { useEffect, useState } from "react";
import type { VideoSyncSource } from "../lib/player-sync.ts";
import type { StoredAudio } from "../lib/storage.ts";
import { ErrorPanel, Fab, Panel } from "./audio-replacement.tsx";
import { StemGeneratorMockup } from "./stem-generator-mockup.tsx";

export class FakeVideo extends EventTarget implements VideoSyncSource {
  currentTime = 0;
  muted = false;
  paused = true;
  playbackRate = 1;
  volume = 0.8;
}

const fakeVideo = new FakeVideo();

const previewAudio: StoredAudio = {
  videoId: "preview-video",
  name: "example.stems.zip",
  tracks: [
    {
      name: "vocals.wav",
      blob: new Blob(),
    },
    {
      name: "drums.wav",
      blob: new Blob(),
    },
    {
      name: "bass.wav",
      blob: new Blob(),
    },
    {
      name: "other.wav",
      blob: new Blob(),
    },
  ],
};

export function PreviewApp() {
  const [mockup, setMockup] = useState(isMockupRoute);
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string>();
  const [withAudio, setWithAudio] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    return () => document.documentElement.classList.remove("dark");
  }, [dark]);

  useEffect(() => {
    const syncRoute = () => setMockup(isMockupRoute());
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  function navigateToMockup(nextMockup: boolean) {
    const url = new URL(location.href);
    if (nextMockup) {
      url.searchParams.set("view", "mockup");
    } else {
      url.searchParams.delete("view");
    }
    history.pushState({}, "", url);
    setMockup(nextMockup);
  }

  if (mockup) {
    return (
      <>
        <StemGeneratorMockup />
        <button
          className="fixed top-3 right-3 z-20 cursor-pointer rounded-md border border-button-border bg-panel px-2.5 py-1.5 text-xs text-foreground shadow-lg hover:bg-button-hover"
          type="button"
          onClick={() => navigateToMockup(false)}
        >
          Panel preview
        </button>
      </>
    );
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-button p-8 font-sans text-foreground">
      <div className="flex flex-col items-end gap-3">
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="cursor-pointer rounded-md border border-button-border bg-panel px-2.5 py-1.5 text-xs hover:bg-button-hover"
            type="button"
            onClick={() => navigateToMockup(true)}
          >
            App mockup
          </button>
          <button
            className="cursor-pointer rounded-md border border-button-border bg-panel px-2.5 py-1.5 text-xs hover:bg-button-hover"
            type="button"
            onClick={() => setWithAudio((value) => !value)}
          >
            {withAudio ? "Empty state" : "Selected state"}
          </button>
          <button
            className="cursor-pointer rounded-md border border-button-border bg-panel px-2.5 py-1.5 text-xs hover:bg-button-hover"
            type="button"
            onClick={() =>
              setError((current) =>
                current
                  ? undefined
                  : "Audio is available for this session but could not be saved.",
              )
            }
          >
            {error ? "Clear error" : "Error preview"}
          </button>
          <button
            className="cursor-pointer rounded-md border border-button-border bg-panel px-2.5 py-1.5 text-xs hover:bg-button-hover"
            type="button"
            onClick={() => setDark((value) => !value)}
          >
            {dark ? "Light preview" : "Dark preview"}
          </button>
        </div>
        {/* TODO: Replace the fake clock with manual video upload or a YouTube
            IFrame API adapter when transport testing is in scope. */}
        <div className="pointer-events-none fixed right-4 bottom-14 flex flex-col items-end gap-2">
          {error && (
            <ErrorPanel message={error} onClose={() => setError(undefined)} />
          )}
          <div className={open ? "pointer-events-auto" : "hidden"}>
            <Panel
              key={withAudio ? "selected" : "empty"}
              videoId="preview-video"
              getVideo={() => fakeVideo}
              initialSelectedAudio={withAudio ? previewAudio : undefined}
              onSelectAudio={() => undefined}
              onGenerate={() => undefined}
              onError={setError}
            />
          </div>
        </div>
        <Fab open={open} onClick={() => setOpen((value) => !value)} />
      </div>
    </main>
  );
}

function isMockupRoute() {
  return new URL(location.href).searchParams.get("view") === "mockup";
}
