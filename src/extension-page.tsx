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
import { modelArtifactManager } from "./lib/demucs/audio/artifact-store.ts";
import { AUDIO_SAMPLE_RATE } from "./lib/demucs/audio/constants.ts";
import { decodeAudioFile } from "./lib/demucs/audio/decode.ts";
import {
  isModelFilename,
  type ModelArtifact,
  type ModelFilename,
  type ModelSource,
  requiredModelFiles,
} from "./lib/demucs/audio/models.ts";
import type { SeparateRequest } from "./lib/demucs/audio/separate.ts";
import {
  createStemArchive,
  downloadBlob,
  toStemArchiveFilename,
} from "./lib/demucs/audio/stem-archive.ts";
import { encodeWavF32 } from "./lib/demucs/audio/wav.ts";
import { separateInWorker } from "./lib/demucs/audio/worker-client.ts";
import { loadPreferences, savePreferences } from "./lib/demucs/preferences.ts";
import {
  type RunProgress,
  updateRunProgress,
} from "./lib/demucs/progress/model.ts";
import { createHiddenIframeRpc } from "./lib/rpc/iframe.ts";
import { EMBED_READY } from "./lib/rpc/shared.ts";
import { formatBytes, formatDuration, once } from "./lib/utils.ts";
import { parseVideoId } from "./lib/youtube.ts";
import {
  type StemGeneratorSourceMode,
  type StemGeneratorSourceStates,
  StemGeneratorView,
} from "./ui/stem-generator.tsx";
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
  const [sourceMode, setSourceMode] =
    useState<StemGeneratorSourceMode>("youtube");
  const [sourceStates, setSourceStates] = useState<StemGeneratorSourceStates>({
    youtube: { status: "empty" },
    local: { status: "empty" },
  });
  const sourceFilesRef = useRef<Partial<Record<StemGeneratorSourceMode, File>>>(
    {},
  );
  const outputCleanupRef = useRef<(() => void)[]>([]);
  // synchronize preferences with localStorage
  const [preferences, setPreferences] = useState(loadPreferences);
  useEffect(() => savePreferences(preferences), [preferences]);

  const [selectedModelFiles, setSelectedModelFiles] = useState<
    Partial<Record<ModelFilename, ModelArtifact>>
  >({});
  const [unsupportedModelFiles, setUnsupportedModelFiles] = useState<string[]>(
    [],
  );
  const [modelFileErrors, setModelFileErrors] = useState<
    Partial<Record<ModelFilename, string>>
  >({});
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null);

  const { model, method, shifts, twoStems } = preferences;

  const loadStoredModelsQuery = useQuery({
    queryKey: ["stored-models"],
    queryFn: modelArtifactManager.load,
  });
  const storeModelsMutation = useMutation({
    mutationFn: modelArtifactManager.store,
  });
  const modelFiles: Partial<Record<ModelFilename, ModelArtifact>> = {
    ...Object.fromEntries(
      (loadStoredModelsQuery.data ?? []).map((artifact) => [
        artifact.name,
        artifact,
      ]),
    ),
    ...selectedModelFiles,
  };
  const requiredFiles = requiredModelFiles(
    model,
    twoStems || undefined,
    twoStems ? method : undefined,
  );
  const modelSource: ModelSource | null = requiredFiles.every(
    (filename) => modelFiles[filename],
  )
    ? { artifacts: Object.values(modelFiles) }
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
      const sourceFile = sourceFilesRef.current[sourceMode];
      if (!sourceFile || !modelSource) {
        throw new Error("Audio and model files are required.");
      }
      clearOutputUrls();
      const started = performance.now();
      const decoded = await decodeAudioFile(sourceFile);
      const request: SeparateRequest = {
        left: decoded.left.slice(),
        right: decoded.right.slice(),
        model,
        twoStems: twoStems ? { source: twoStems, method } : undefined,
        shifts,
        modelSource,
      };
      const separated = await separateInWorker(request, {
        onProgress: (event, at) =>
          setRunProgress((current) =>
            current ? updateRunProgress(current, event, at) : current,
          ),
      });
      const outputs = separated.map((output) => {
        const blob = encodeWavF32(
          [output.left, output.right],
          AUDIO_SAMPLE_RATE,
        );
        return { ...output, blob, url: URL.createObjectURL(blob) };
      });
      outputCleanupRef.current = outputs.map(
        (output) => () => URL.revokeObjectURL(output.url),
      );
      const durationMs = performance.now() - started;
      const archiveBlob = await createStemArchive(outputs);
      const archive = {
        name: toStemArchiveFilename(decoded.name),
        url: URL.createObjectURL(archiveBlob),
      };
      outputCleanupRef.current.push(() => URL.revokeObjectURL(archive.url));
      return { outputs, archive, durationMs };
    },
    onMutate: () =>
      setRunProgress({
        phase: "preparing",
        startedAt: Date.now(),
        done: 0,
        total: 0,
        models: [],
        finalizeMs: 0,
      }),
    onSuccess: ({ archive }) => downloadBlob(archive.url, archive.name),
    onSettled: (_data, error) => {
      if (error) {
        setRunProgress(null);
      }
    },
  });

  function resetSeparation() {
    clearOutputUrls();
    runSeparationMutation.reset();
    setRunProgress(null);
  }

  function setSourceState(
    mode: StemGeneratorSourceMode,
    state: StemGeneratorSourceStates[StemGeneratorSourceMode],
  ) {
    setSourceStates((current) => ({ ...current, [mode]: state }));
  }

  function changeSourceMode(mode: StemGeneratorSourceMode) {
    resetSeparation();
    setSourceMode(mode);
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
      resetSeparation();
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
    resetSeparation();
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
    resetSeparation();
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

  function addModelFiles(files: File[], expected?: ModelFilename) {
    const accepted = files.filter(
      (file) =>
        isModelFilename(file.name) && (!expected || file.name === expected),
    );
    setUnsupportedModelFiles(
      expected
        ? []
        : files
            .filter((file) => !isModelFilename(file.name))
            .map((file) => file.name),
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
    setSelectedModelFiles((current) => ({
      ...current,
      ...Object.fromEntries(
        accepted.map((file) => [file.name, { name: file.name, blob: file }]),
      ),
    }));
    if (accepted.length > 0) {
      resetSeparation();
      storeModelsMutation.mutate(accepted);
    }
  }

  const modelStorageError = loadStoredModelsQuery.error
    ? "Browser storage is unavailable; uploads still work."
    : storeModelsMutation.error instanceof DOMException &&
        storeModelsMutation.error.name === "QuotaExceededError"
      ? "Browser storage is full; files are available for this session only."
      : storeModelsMutation.error
        ? "Files are available for this session but could not be stored."
        : "";

  const separationStatusText = runSeparationMutation.data
    ? `Done in ${(runSeparationMutation.data.durationMs / 1000).toFixed(1)}s`
    : "";

  return (
    <StemGeneratorView
      initialInput={initialInput}
      sourceMode={sourceMode}
      sourceStates={sourceStates}
      sourceError={
        loadYouTubeAudioMutation.error instanceof Error
          ? loadYouTubeAudioMutation.error.message
          : undefined
      }
      onLoadYouTube={loadYouTubeAudioMutation.mutate}
      onChooseLocalFile={chooseLocalFile}
      onSourceModeChange={changeSourceMode}
      onRemoveSource={removeSource}
      onSaveSource={saveSource}
      configuration={preferences}
      onConfigurationChange={(next) => {
        resetSeparation();
        setPreferences(next);
      }}
      modelFiles={requiredFiles.map((name) => ({
        name,
        ready: Boolean(modelFiles[name]),
        error: modelFileErrors[name],
      }))}
      unsupportedModelFiles={unsupportedModelFiles}
      modelStorageError={modelStorageError}
      onChooseModelFiles={addModelFiles}
      separationPending={runSeparationMutation.isPending}
      separationProgress={runProgress}
      separationStatus={separationStatusText}
      separationError={
        runSeparationMutation.error instanceof Error
          ? runSeparationMutation.error.message
          : undefined
      }
      onSeparate={() => runSeparationMutation.mutate()}
      canSeparate={Boolean(sourceFilesRef.current[sourceMode] && modelSource)}
      results={runSeparationMutation.data}
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
