import { useEffect, useRef, useState } from "react";
import type { Preferences } from "../lib/demucs/preferences.ts";
import type { StoredAudio } from "../lib/storage.ts";
import { ExtensionPageView, type ExtensionView } from "./extension-page.tsx";
import { SavedVideosView } from "./saved-videos.tsx";
import {
  type StemGeneratorSourceMode,
  type StemGeneratorSourceStates,
  StemGeneratorView,
} from "./stem-generator.tsx";

export function ExtensionPagePreview({
  initialView = "generator",
  emptySavedVideos = false,
}: {
  initialView?: ExtensionView;
  emptySavedVideos?: boolean;
}) {
  const [view, setView] = useState(initialView);

  return (
    <ExtensionPageView view={view} onViewChange={setView}>
      {view === "generator" ? (
        <StemGeneratorMockup />
      ) : (
        <SavedVideosView
          videos={emptySavedVideos ? [] : PREVIEW_SAVED_VIDEOS}
          loading={false}
          onDelete={() => undefined}
        />
      )}
    </ExtensionPageView>
  );
}

const PREVIEW_SAVED_VIDEOS: StoredAudio[] = [
  {
    videoId: "YsmSk0cZa6w",
    videoMetadata: {
      title: "Bass cover with a deliberately long video title",
    },
    name: "bass-and-drums.zip",
    tracks: [
      {
        name: "bass.wav",
        blob: new Blob([new Uint8Array(38_400_000)]),
      },
    ],
    savedAt: Date.UTC(2026, 6, 17),
  },
  {
    videoId: "7GU_VQfgMT0",
    videoMetadata: { title: "Live session rehearsal" },
    name: "vocals.wav",
    tracks: [
      {
        name: "vocals.wav",
        blob: new Blob([new Uint8Array(12_800_000)]),
      },
    ],
    savedAt: Date.UTC(2026, 6, 14),
  },
  {
    videoId: "fallback-id",
    name: "replacement-audio.wav",
    tracks: [
      {
        name: "replacement-audio.wav",
        blob: new Blob([new Uint8Array(6_400_000)]),
      },
    ],
  },
];

function StemGeneratorMockup() {
  const loadingTimeoutRef = useRef<number>(undefined);
  const [sourceMode, setSourceMode] =
    useState<StemGeneratorSourceMode>("youtube");
  const [sourceStates, setSourceStates] = useState<StemGeneratorSourceStates>({
    youtube: { status: "empty" },
    local: { status: "empty" },
  });
  const [configuration, setConfiguration] = useState<Preferences>({
    model: "htdemucs",
    twoStems: null,
    method: "add",
    shifts: 1,
  });

  useEffect(() => () => window.clearTimeout(loadingTimeoutRef.current), []);

  function setSourceState(
    mode: StemGeneratorSourceMode,
    state: StemGeneratorSourceStates[StemGeneratorSourceMode],
  ) {
    setSourceStates((current) => ({ ...current, [mode]: state }));
  }

  return (
    <StemGeneratorView
      initialInput="https://www.youtube.com/watch?v=YsmSk0cZa6w"
      sourceMode={sourceMode}
      sourceStates={sourceStates}
      onLoadYouTube={() => {
        setSourceState("youtube", {
          status: "loading",
          progress: { bytesReceived: 19_200_000, totalBytes: 38_400_000 },
        });
        loadingTimeoutRef.current = window.setTimeout(() => {
          setSourceState("youtube", {
            status: "ready",
            source: {
              name: "Example YouTube track",
              detail: "Example channel / 4:32 / 38.4 MB",
            },
          });
        }, 1_000);
      }}
      onChooseLocalFile={(file) =>
        setSourceState("local", {
          status: "ready",
          source: {
            name: file.name,
            detail: `${(file.size / 1_000_000).toFixed(1)} MB`,
          },
        })
      }
      onSourceModeChange={setSourceMode}
      onRemoveSource={(mode) => setSourceState(mode, { status: "empty" })}
      onSaveSource={() => undefined}
      configuration={configuration}
      onConfigurationChange={setConfiguration}
      modelFiles={[
        { name: "dft.bin", ready: true },
        {
          name: "htdemucs.onnx",
          ready: true,
        },
      ]}
      unsupportedModelFiles={[]}
      onChooseModelFiles={() => undefined}
      separationPending={false}
      onSeparate={() => undefined}
      canSeparate
    />
  );
}
