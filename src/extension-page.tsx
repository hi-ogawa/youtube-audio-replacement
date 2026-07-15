import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  DownloadProgress,
  EmbedContentRpcHandlers,
} from "./embed-content.ts";
import { createHiddenIframeRpc } from "./lib/rpc/iframe.ts";
import { EMBED_READY } from "./lib/rpc/shared.ts";
import { formatBytes, formatDuration, once } from "./lib/utils.ts";
import { parseVideoId, selectAudioFormat } from "./lib/youtube.ts";
import {
  type StemsGeneratorSourceState,
  StemsGeneratorView,
} from "./ui/stems-generator.tsx";
import "./styles.css";

const initEmbedContentRpc = once(() =>
  createHiddenIframeRpc<EmbedContentRpcHandlers>({
    src: "https://www.youtube.com/embed/",
    origin: "https://www.youtube.com",
    readyMessage: EMBED_READY,
    timeoutMs: 15_000,
  }),
);

function ExtensionPage() {
  const initialInput = new URL(location.href).searchParams.get("videoId") ?? "";
  const [sourceState, setSourceState] = useState<StemsGeneratorSourceState>({
    status: "empty",
  });
  const [sourceError, setSourceError] = useState<string>();
  const sourceFileRef = useRef<File>(null);

  async function loadYouTubeAudio(input: string) {
    const videoId = parseVideoId(input);
    if (!videoId) {
      setSourceError("Enter a valid YouTube video ID or URL.");
      return;
    }

    sourceFileRef.current = null;
    setSourceError(undefined);
    setSourceState({ status: "loading" });
    try {
      const rpc = await initEmbedContentRpc();
      const metadata = await rpc.getStreamingFormats({ videoId });
      const format = selectAudioFormat(metadata.streamingFormats);
      if (!format) {
        throw new Error(
          "No complete audio-only format is available for this video.",
        );
      }

      const onProgress = (progress: DownloadProgress) => {
        setSourceState({ status: "loading", progress });
      };
      const result = await rpc.downloadFormat({
        videoId,
        itag: format.itag,
        onProgress,
      });
      const file = new File([result.data], result.filename, {
        type: result.mimeType,
      });
      sourceFileRef.current = file;
      setSourceState({
        status: "ready",
        source: {
          kind: "YouTube",
          name: metadata.video.title,
          detail: `${metadata.video.channelName} / ${formatDuration(metadata.video.duration)} / ${formatBytes(file.size)}`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSourceState({ status: "empty" });
      setSourceError(message);
    }
  }

  function chooseLocalFile(file: File) {
    sourceFileRef.current = file;
    setSourceError(undefined);
    setSourceState({
      status: "ready",
      source: {
        kind: "Local file",
        name: file.name,
        detail: formatBytes(file.size),
      },
    });
  }

  function removeSource() {
    sourceFileRef.current = null;
    setSourceError(undefined);
    setSourceState({ status: "empty" });
  }

  function saveSource() {
    const file = sourceFileRef.current;
    if (!file) {
      return;
    }
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url));
  }

  return (
    <StemsGeneratorView
      initialInput={initialInput}
      sourceState={sourceState}
      sourceError={sourceError}
      onLoadYouTube={(input) => void loadYouTubeAudio(input)}
      onChooseLocalFile={chooseLocalFile}
      onRemoveSource={removeSource}
      onSaveSource={saveSource}
    />
  );
}

function main() {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Root element not found");
  }
  createRoot(root).render(
    <StrictMode>
      <ExtensionPage />
    </StrictMode>,
  );
}

main();
