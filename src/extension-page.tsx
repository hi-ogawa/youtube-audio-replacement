import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  DownloadProgress,
  EmbedContentRpcHandlers,
} from "./embed-content.ts";
import { createHiddenIframeRpc } from "./lib/rpc/iframe.ts";
import { EMBED_READY } from "./lib/rpc/shared.ts";
import { formatBytes, formatDuration, once } from "./lib/utils.ts";
import { parseVideoId } from "./lib/youtube.ts";
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

function ExtensionPage({ initialInput }: { initialInput: string }) {
  const [sourceState, setSourceState] = useState<StemsGeneratorSourceState>({
    status: "empty",
  });
  const sourceFileRef = useRef<File>(null);

  const loadYouTubeAudioMutation = useMutation({
    mutationFn: async (input: string) => {
      const videoId = parseVideoId(input);
      if (!videoId) {
        throw new Error("Enter a valid YouTube video ID or URL.");
      }
      const rpc = await initEmbedContentRpc();
      const onProgress = (progress: DownloadProgress) => {
        setSourceState({ status: "loading", progress });
      };
      const result = await rpc.download({
        videoId,
        onProgress,
      });
      const file = new File([result.data], result.filename, {
        type: result.mimeType,
      });
      return { file, video: result.video };
    },
    onMutate: () => {
      sourceFileRef.current = null;
      setSourceState({ status: "loading" });
    },
    onSuccess: ({ file, video }) => {
      sourceFileRef.current = file;
      setSourceState({
        status: "ready",
        source: {
          kind: "YouTube",
          name: video.title,
          detail: `${video.channelName} / ${formatDuration(video.duration)} / ${formatBytes(file.size)}`,
        },
      });
    },
    onError: () => {
      setSourceState({ status: "empty" });
    },
  });

  function chooseLocalFile(file: File) {
    loadYouTubeAudioMutation.reset();
    sourceFileRef.current = file;
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
    loadYouTubeAudioMutation.reset();
    sourceFileRef.current = null;
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
      sourceError={
        loadYouTubeAudioMutation.error instanceof Error
          ? loadYouTubeAudioMutation.error.message
          : undefined
      }
      onLoadYouTube={loadYouTubeAudioMutation.mutate}
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
  const initialInput = new URL(location.href).searchParams.get("videoId") ?? "";
  const queryClient = new QueryClient();
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ExtensionPage initialInput={initialInput} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

main();
