import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  DownloadProgress,
  embedContentRpcHandlers,
} from "./embed-content.ts";
import { createHiddenIframeRpc } from "./lib/rpc/iframe.ts";
import { once } from "./lib/utils.ts";
import type { PlayerApiResult, YouTubeStreamingFormat } from "./lib/youtube.ts";
import "./styles.css";

type Phase = "connecting" | "ready" | "downloading" | "cancelled" | "error";

const initEmbedContentRpc = once(() =>
  createHiddenIframeRpc<typeof embedContentRpcHandlers>({
    src: "https://www.youtube.com/embed/",
    origin: "https://www.youtube.com",
    readyMessage: "audio-replacement-embed-ready",
    timeoutMs: 15_000,
  }),
);

function selectAudioFormat(formats: YouTubeStreamingFormat[]) {
  const audioFormats = formats.filter(
    (format) =>
      format.mimeType.startsWith("audio/") && Boolean(format.contentLength),
  );
  const opusFormats = audioFormats.filter((format) =>
    format.mimeType.includes("opus"),
  );
  return (opusFormats.length > 0 ? opusFormats : audioFormats).sort(
    (left, right) => (right.contentLength ?? 0) - (left.contentLength ?? 0),
  )[0];
}

function Generator() {
  const videoId = new URL(location.href).searchParams.get("videoId");
  const [phase, setPhase] = useState<Phase>(videoId ? "connecting" : "ready");
  const [metadata, setMetadata] = useState<PlayerApiResult>();
  const [progress, setProgress] = useState<DownloadProgress>();
  const [source, setSource] = useState<File>();
  const [sourceUrl, setSourceUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const downloadIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!videoId) {
      return;
    }
    let active = true;
    void initEmbedContentRpc()
      .then((rpc) => rpc.getStreamingFormats({ videoId }))
      .then((result) => {
        if (active) {
          setMetadata(result);
          setPhase("ready");
        }
      })
      .catch((nextError: unknown) => {
        if (active) {
          setError(
            nextError instanceof Error ? nextError.message : String(nextError),
          );
          setPhase("error");
        }
      });
    return () => {
      active = false;
    };
  }, [videoId]);

  useEffect(() => {
    if (!source) {
      setSourceUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(source);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  async function loadYouTubeAudio() {
    if (!videoId || !metadata) {
      return;
    }
    const format = selectAudioFormat(metadata.streamingFormats);
    if (!format) {
      setError("No complete audio-only format is available for this video.");
      setPhase("error");
      return;
    }

    const downloadId = crypto.randomUUID();
    downloadIdRef.current = downloadId;
    setProgress({ bytesReceived: 0, totalBytes: format.contentLength ?? 0 });
    setError(undefined);
    setPhase("downloading");
    try {
      const rpc = await initEmbedContentRpc();
      const result = await rpc.downloadFormat({
        videoId,
        itag: format.itag,
        downloadId,
        onProgress: setProgress,
      });
      setSource(
        new File([result.data], result.filename, { type: result.mimeType }),
      );
      setPhase("ready");
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : String(nextError);
      if (message.includes("aborted")) {
        setPhase("cancelled");
      } else {
        setError(message);
        setPhase("error");
      }
    } finally {
      downloadIdRef.current = undefined;
    }
  }

  async function cancel() {
    const downloadId = downloadIdRef.current;
    if (!downloadId) {
      return;
    }
    const rpc = await initEmbedContentRpc();
    await rpc.cancelDownload({ downloadId });
  }

  const progressPercent = progress?.totalBytes
    ? Math.round((progress.bytesReceived / progress.totalBytes) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-button px-5 py-10 font-sans text-foreground">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-border bg-panel shadow-lg">
        <header className="border-b border-border px-6 py-5">
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">
            YouTube Audio Replacement
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Stem generator</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prepare complete source audio for stem separation.
          </p>
        </header>

        <div className="space-y-6 p-6">
          {videoId && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">YouTube source</h2>
              {phase === "connecting" ? (
                <p className="text-sm text-muted-foreground">
                  Connecting to YouTube...
                </p>
              ) : metadata ? (
                <div className="rounded-lg border border-border bg-button p-4">
                  <p className="font-medium">{metadata.video.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {metadata.video.channelName} ·{" "}
                    {formatDuration(metadata.video.duration)}
                  </p>
                  {phase === "downloading" ? (
                    <div className="mt-4 space-y-2">
                      <div className="h-2 overflow-hidden rounded-full bg-button-border">
                        <div
                          className="h-full bg-accent transition-[width]"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {formatBytes(progress?.bytesReceived ?? 0)} /{" "}
                          {formatBytes(progress?.totalBytes ?? 0)}
                        </span>
                        <button
                          className="cursor-pointer font-medium text-error hover:underline"
                          type="button"
                          onClick={() => void cancel()}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="mt-4 cursor-pointer rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                      type="button"
                      onClick={() => void loadYouTubeAudio()}
                    >
                      Load audio from YouTube
                    </button>
                  )}
                </div>
              ) : null}
            </section>
          )}

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Local source</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use an audio file from your computer instead.
              </p>
            </div>
            <label className="inline-flex cursor-pointer rounded-md border border-button-border bg-button px-4 py-2 text-sm font-medium hover:bg-button-hover">
              Choose audio file
              <input
                type="file"
                accept="audio/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setSource(file);
                    setError(undefined);
                    setPhase("ready");
                  }
                  event.target.value = "";
                }}
              />
            </label>
          </section>

          {phase === "cancelled" && (
            <p className="rounded-md border border-border bg-button p-3 text-sm">
              Audio download cancelled.
            </p>
          )}
          {error && (
            <p
              className="rounded-md border border-error/40 p-3 text-sm text-error"
              role="alert"
            >
              {error}
            </p>
          )}

          {source && sourceUrl && (
            <section className="space-y-3 border-t border-border pt-5">
              <div>
                <h2 className="text-sm font-semibold">Source audio ready</h2>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {source.name} · {formatBytes(source.size)}
                </p>
              </div>
              <audio className="w-full" controls src={sourceUrl} />
              <a
                className="inline-flex rounded-md border border-button-border bg-button px-4 py-2 text-sm font-medium hover:bg-button-hover"
                href={sourceUrl}
                download={source.name}
              >
                Save source audio
              </a>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) {
    return "0 MB";
  }
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}
createRoot(root).render(
  <StrictMode>
    <Generator />
  </StrictMode>,
);
