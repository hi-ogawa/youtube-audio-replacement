import { useEffect, useRef, useState } from "react";
import type { Preferences } from "../lib/demucs/preferences.ts";
import {
  type StemGeneratorSourceMode,
  type StemGeneratorSourceStates,
  StemGeneratorView,
} from "./stem-generator.tsx";

export function StemGeneratorMockup() {
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
