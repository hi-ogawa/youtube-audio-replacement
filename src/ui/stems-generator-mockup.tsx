import { useState } from "react";
import {
  type StemsGeneratorSourceState,
  StemsGeneratorView,
} from "./stems-generator.tsx";

export function StemsGeneratorMockup() {
  const [sourceState, setSourceState] = useState<StemsGeneratorSourceState>({
    status: "empty",
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
      onCancelLoad={() => setSourceState({ status: "empty" })}
      onRemoveSource={() => setSourceState({ status: "empty" })}
      onSaveSource={() => undefined}
    />
  );
}
