import { useState } from "react";
import {
  type StemsGeneratorSourceMode,
  type StemsGeneratorSourceStates,
  StemsGeneratorView,
} from "./stems-generator.tsx";

export function StemsGeneratorMockup() {
  const [sourceStates, setSourceStates] = useState<StemsGeneratorSourceStates>({
    youtube: { status: "empty" },
    local: { status: "empty" },
  });

  function setSourceState(
    mode: StemsGeneratorSourceMode,
    state: StemsGeneratorSourceStates[StemsGeneratorSourceMode],
  ) {
    setSourceStates((current) => ({ ...current, [mode]: state }));
  }

  return (
    <StemsGeneratorView
      initialInput="https://www.youtube.com/watch?v=YsmSk0cZa6w"
      sourceStates={sourceStates}
      onLoadYouTube={() =>
        setSourceState("youtube", {
          status: "ready",
          source: {
            name: "Example YouTube track",
            detail: "Example channel / 4:32 / 38.4 MB",
          },
        })
      }
      onChooseLocalFile={(file) =>
        setSourceState("local", {
          status: "ready",
          source: {
            name: file.name,
            detail: `${(file.size / 1_000_000).toFixed(1)} MB`,
          },
        })
      }
      onRemoveSource={(mode) => setSourceState(mode, { status: "empty" })}
      onSaveSource={() => undefined}
    />
  );
}
