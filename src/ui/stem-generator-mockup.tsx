import { useEffect, useRef, useState } from "react";
import type { SeparationConfiguration } from "../lib/demucs/models.ts";
import {
  type StemGeneratorSourceMode,
  type StemGeneratorSourceStates,
  StemGeneratorView,
} from "./stem-generator.tsx";

export function StemGeneratorMockup() {
  const loadingTimeoutRef = useRef<number>(undefined);
  const [sourceStates, setSourceStates] = useState<StemGeneratorSourceStates>({
    youtube: { status: "empty" },
    local: { status: "empty" },
  });
  const [configuration, setConfiguration] = useState<SeparationConfiguration>({
    model: "htdemucs_ft",
    twoStems: "bass",
    method: "minus",
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
      onSourceModeChange={() => undefined}
      onRemoveSource={(mode) => setSourceState(mode, { status: "empty" })}
      onSaveSource={() => undefined}
      configuration={configuration}
      onConfigurationChange={setConfiguration}
      modelFiles={[
        { name: "dft.bin", ready: true, downloadUrl: "#" },
        {
          name: "htdemucs_ft_bass.onnx",
          ready: true,
          downloadUrl: "#",
        },
      ]}
      onChooseModelFiles={() => undefined}
      separationPending={false}
      onSeparate={() => undefined}
      canSeparate
    />
  );
}
