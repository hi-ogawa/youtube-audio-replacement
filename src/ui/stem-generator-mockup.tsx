import { useState } from "react";
import {
  type StemGeneratorSourceMode,
  type StemGeneratorSourceStates,
  StemGeneratorView,
} from "./stem-generator.tsx";

export function StemGeneratorMockup() {
  const [sourceStates, setSourceStates] = useState<StemGeneratorSourceStates>({
    youtube: { status: "empty" },
    local: { status: "empty" },
  });

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
