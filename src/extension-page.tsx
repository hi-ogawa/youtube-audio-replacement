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
  type StemGeneratorSourceMode,
  type StemGeneratorSourceStates,
  StemGeneratorView,
} from "./ui/stem-generator.tsx";
import "./ui/styles.css";

const initEmbedContentRpc = once(() =>
  createHiddenIframeRpc<EmbedContentRpcHandlers>({
    src: "https://www.youtube.com/embed/",
    origin: "https://www.youtube.com",
    readyMessage: EMBED_READY,
    timeoutMs: 15_000,
  }),
);

function ExtensionPage({ initialInput }: { initialInput: string }) {
  const [sourceStates, setSourceStates] = useState<StemGeneratorSourceStates>({
    youtube: { status: "empty" },
    local: { status: "empty" },
  });
  const sourceFilesRef = useRef<Partial<Record<StemGeneratorSourceMode, File>>>(
    {},
  );

  function setSourceState(
    mode: StemGeneratorSourceMode,
    state: StemGeneratorSourceStates[StemGeneratorSourceMode],
  ) {
    setSourceStates((current) => ({ ...current, [mode]: state }));
  }

  const loadYouTubeAudioMutation = useMutation({
    mutationFn: async (input: string) => {
      const videoId = parseVideoId(input);
      if (!videoId) {
        throw new Error("Enter a valid YouTube video ID or URL.");
      }
      const rpc = await initEmbedContentRpc();
      const onProgress = (progress: DownloadProgress) => {
        setSourceState("youtube", { status: "loading", progress });
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
      delete sourceFilesRef.current.youtube;
      setSourceState("youtube", { status: "loading" });
    },
    onSuccess: ({ file, video }) => {
      sourceFilesRef.current.youtube = file;
      setSourceState("youtube", {
        status: "ready",
        source: {
          name: video.title,
          detail: `${video.channelName} / ${formatDuration(video.duration)} / ${formatBytes(file.size)}`,
        },
      });
    },
    onError: () => {
      setSourceState("youtube", { status: "empty" });
    },
  });

  function chooseLocalFile(file: File) {
    sourceFilesRef.current.local = file;
    setSourceState("local", {
      status: "ready",
      source: {
        name: file.name,
        detail: formatBytes(file.size),
      },
    });
  }

  function removeSource(mode: StemGeneratorSourceMode) {
    if (mode === "youtube") {
      loadYouTubeAudioMutation.reset();
    }
    delete sourceFilesRef.current[mode];
    setSourceState(mode, { status: "empty" });
  }

  function saveSource() {
    const file = sourceFilesRef.current.youtube;
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
    <StemGeneratorView
      initialInput={initialInput}
      sourceStates={sourceStates}
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
  // Start loading the YouTube iframe before the user requests a download.
  initEmbedContentRpc();
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
