import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  DownloadProgress,
  EmbedContentRpcHandlers,
} from "./embed-content.ts";
import { modelArtifactManager } from "./lib/demucs/artifact-store.ts";
import {
  createStemArchive,
  decodeAudioFile,
  downloadBlob,
  encodeWavF32,
  toStemArchiveFilename,
} from "./lib/demucs/audio.ts";
import {
  isModelFilename,
  type ModelArtifact,
  type ModelFilename,
  modelAssetUrl,
  requiredModelFiles,
  type SeparationConfiguration,
} from "./lib/demucs/models.ts";
import {
  initialRunProgress,
  type RunProgress,
  updateRunProgress,
} from "./lib/demucs/progress.ts";
import { separateInWorker } from "./lib/demucs/worker-client.ts";
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
  const outputCleanupRef = useRef<(() => void)[]>([]);
  const [configuration, setConfiguration] = useState<SeparationConfiguration>({
    model: "htdemucs_ft",
    twoStems: "bass",
    method: "minus",
    shifts: 1,
  });
  const [selectedModelFiles, setSelectedModelFiles] = useState<
    Partial<Record<ModelFilename, ModelArtifact>>
  >({});
  const [modelFileErrors, setModelFileErrors] = useState<
    Partial<Record<ModelFilename, string>>
  >({});
  const [modelSelectionError, setModelSelectionError] = useState<string>();
  const [runProgress, setRunProgress] = useState<RunProgress>();

  const loadStoredModelsQuery = useQuery({
    queryKey: ["demucs-models"],
    queryFn: modelArtifactManager.load,
  });
  const storeModelsMutation = useMutation({
    mutationFn: modelArtifactManager.store,
  });
  const modelFiles = new Map<ModelFilename, ModelArtifact>();
  for (const artifact of loadStoredModelsQuery.data ?? []) {
    modelFiles.set(artifact.name, artifact);
  }
  for (const artifact of Object.values(selectedModelFiles)) {
    if (artifact) {
      modelFiles.set(artifact.name, artifact);
    }
  }
  const requiredFiles = requiredModelFiles(configuration);
  const modelSource = requiredFiles.every((filename) =>
    modelFiles.has(filename),
  )
    ? { artifacts: [...modelFiles.values()] }
    : null;

  function clearOutputUrls() {
    for (const cleanup of outputCleanupRef.current) {
      cleanup();
    }
    outputCleanupRef.current = [];
  }

  useEffect(() => clearOutputUrls, []);

  const runSeparationMutation = useMutation({
    mutationFn: async () => {
      const sourceFile = sourceFileRef.current;
      if (!sourceFile || !modelSource) {
        throw new Error("Audio and model files are required.");
      }
      clearOutputUrls();
      const decoded = await decodeAudioFile(sourceFile);
      const separated = await separateInWorker(
        {
          ...configuration,
          left: decoded.left,
          right: decoded.right,
          modelSource,
        },
        (event, at) =>
          setRunProgress((current) =>
            current ? updateRunProgress(current, event, at) : current,
          ),
      );
      const outputs = separated.map((output) => {
        const blob = encodeWavF32([output.left, output.right]);
        const url = URL.createObjectURL(blob);
        outputCleanupRef.current.push(() => URL.revokeObjectURL(url));
        return { name: output.name, blob, url };
      });
      const archiveBlob = await createStemArchive(outputs);
      const archive = {
        name: toStemArchiveFilename(decoded.name),
        url: URL.createObjectURL(archiveBlob),
      };
      outputCleanupRef.current.push(() => URL.revokeObjectURL(archive.url));
      return { outputs, archive };
    },
    onMutate: () => setRunProgress(initialRunProgress()),
    onSuccess: ({ archive }) => downloadBlob(archive.url, archive.name),
    onError: () => setRunProgress(undefined),
  });

  function resetSeparation() {
    clearOutputUrls();
    runSeparationMutation.reset();
    setRunProgress(undefined);
  }

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
      resetSeparation();
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
    resetSeparation();
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
    resetSeparation();
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

  function addModelFiles(files: File[], expected?: ModelFilename) {
    const accepted = files.filter(
      (file) =>
        isModelFilename(file.name) && (!expected || file.name === expected),
    );
    const unsupported = files.filter((file) => !isModelFilename(file.name));
    setModelSelectionError(
      unsupported.length > 0
        ? `Unsupported model files: ${unsupported.map((file) => file.name).join(", ")}.`
        : undefined,
    );
    if (expected) {
      const rejected = files.find((file) => file.name !== expected);
      setModelFileErrors((current) => ({
        ...current,
        [expected]: rejected
          ? `Expected ${expected}, received ${rejected.name}.`
          : undefined,
      }));
    }
    if (accepted.length === 0) {
      return;
    }
    resetSeparation();
    setSelectedModelFiles((current) => ({
      ...current,
      ...Object.fromEntries(
        accepted.map((file) => [file.name, { name: file.name, blob: file }]),
      ),
    }));
    storeModelsMutation.mutate(accepted);
  }

  const modelStorageError = loadStoredModelsQuery.error
    ? "Browser model storage is unavailable; selected files still work for this session."
    : storeModelsMutation.error instanceof DOMException &&
        storeModelsMutation.error.name === "QuotaExceededError"
      ? "Browser model storage is full; selected files still work for this session."
      : storeModelsMutation.error
        ? "Model files could not be stored and are available for this session only."
        : modelSelectionError;

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
      configuration={configuration}
      onConfigurationChange={(next) => {
        resetSeparation();
        setConfiguration(next);
      }}
      modelFiles={requiredFiles.map((name) => ({
        name,
        ready: modelFiles.has(name),
        error: modelFileErrors[name],
        downloadUrl: modelAssetUrl(name),
      }))}
      modelStorageError={modelStorageError}
      onChooseModelFiles={addModelFiles}
      separationPending={runSeparationMutation.isPending}
      separationProgress={runProgress}
      separationError={
        runSeparationMutation.error instanceof Error
          ? runSeparationMutation.error.message
          : undefined
      }
      onSeparate={runSeparationMutation.mutate}
      canSeparate={Boolean(sourceFileRef.current && modelSource)}
      results={runSeparationMutation.data}
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
