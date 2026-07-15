import { useState } from "react";
import type { SeparationConfiguration } from "../lib/demucs/models.ts";
import {
  type StemsGeneratorSourceState,
  StemsGeneratorView,
} from "./stems-generator.tsx";

export function StemsGeneratorMockup() {
  const [sourceState, setSourceState] = useState<StemsGeneratorSourceState>({
    status: "empty",
  });
  const [configuration, setConfiguration] = useState<SeparationConfiguration>({
    model: "htdemucs_ft",
    twoStems: "bass",
    method: "minus",
    shifts: 1,
  });

  return (
    <StemsGeneratorView
      initialInput="https://www.youtube.com/watch?v=YsmSk0cZa6w"
      sourceState={sourceState}
      onLoadYouTube={() =>
        setSourceState({
          status: "ready",
          source: {
            kind: "YouTube",
            name: "Example YouTube track",
            detail: "Example channel / 4:32 / 38.4 MB",
          },
        })
      }
      onChooseLocalFile={(file) =>
        setSourceState({
          status: "ready",
          source: {
            kind: "Local file",
            name: file.name,
            detail: `${(file.size / 1_000_000).toFixed(1)} MB`,
          },
        })
      }
      onRemoveSource={() => setSourceState({ status: "empty" })}
      onSaveSource={() => undefined}
      configuration={configuration}
      onConfigurationChange={setConfiguration}
      modelFiles={[
        {
          name: "dft.bin",
          ready: true,
          downloadUrl: "#",
        },
        {
          name: "htdemucs_ft_bass.onnx",
          ready: true,
          downloadUrl: "#",
        },
      ]}
      onChooseModelFiles={() => undefined}
      separationPending={false}
      onSeparate={() => undefined}
      canSeparate={sourceState.status === "ready"}
    />
  );
}
