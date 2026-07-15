import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  DownloadProgress,
  EmbedContentRpcHandlers,
} from "./embed-content.ts";
import {
  type GeneratorSourceState,
  GeneratorView,
} from "./lib/generator-ui.tsx";
import { createHiddenIframeRpc } from "./lib/rpc/iframe.ts";
import { EMBED_READY } from "./lib/rpc/shared.ts";
import { formatBytes, formatDuration, once } from "./lib/utils.ts";
import { parseVideoId, selectAudioFormat } from "./lib/youtube.ts";
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
  const [sourceState, setSourceState] = useState<GeneratorSourceState>({
    status: "empty",
  });
  const [sourceError, setSourceError] = useState<string>();
  const sourceFileRef = useRef<File>(null);
  const downloadIdRef = useRef<string>(null);
  const loadAbortRef = useRef<AbortController>(null);

  async function loadYouTubeAudio(input: string) {
    const videoId = parseVideoId(input);
    if (!videoId) {
      setSourceError("Enter a valid YouTube video ID or URL.");
      return;
    }

    const downloadId = crypto.randomUUID();
    const abortController = new AbortController();
    downloadIdRef.current = downloadId;
    loadAbortRef.current = abortController;
    sourceFileRef.current = null;
    setSourceError(undefined);
    setSourceState({ status: "loading" });
    try {
      const rpc = await initEmbedContentRpc();
      abortController.signal.throwIfAborted();
      const metadata = await rpc.getStreamingFormats({ videoId });
      abortController.signal.throwIfAborted();
      const format = selectAudioFormat(metadata.streamingFormats);
      if (!format) {
        throw new Error(
          "No complete audio-only format is available for this video.",
        );
      }

      const onProgress = (progress: DownloadProgress) => {
        if (loadAbortRef.current === abortController) {
          setSourceState({ status: "loading", progress });
        }
      };
      const result = await rpc.downloadFormat({
        videoId,
        itag: format.itag,
        downloadId,
        onProgress,
      });
      abortController.signal.throwIfAborted();
      const file = new File([result.data], result.filename, {
        type: result.mimeType,
      });
      if (loadAbortRef.current !== abortController) {
        return;
      }
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
      if (loadAbortRef.current !== abortController) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      setSourceState({ status: "empty" });
      if (!message.includes("aborted")) {
        setSourceError(message);
      }
    } finally {
      if (loadAbortRef.current === abortController) {
        downloadIdRef.current = null;
        loadAbortRef.current = null;
      }
    }
  }

  async function cancelLoad() {
    loadAbortRef.current?.abort();
    setSourceState({ status: "empty" });
    const downloadId = downloadIdRef.current;
    if (!downloadId) {
      return;
    }
    const rpc = await initEmbedContentRpc();
    await rpc.cancelDownload({ downloadId });
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
    <GeneratorView
      initialInput={initialInput}
      sourceState={sourceState}
      sourceError={sourceError}
      onLoadYouTube={(input) => void loadYouTubeAudio(input)}
      onChooseLocalFile={chooseLocalFile}
      onCancelLoad={() => void cancelLoad()}
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
