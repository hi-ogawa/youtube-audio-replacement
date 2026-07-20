import { ExternalLink, Music2, Trash2 } from "lucide-react";
import type { StoredAudio } from "../lib/storage.ts";
import { formatBytes } from "../lib/utils.ts";

export function SavedVideosView({
  videos,
  loading,
  error,
  deletingVideoId,
  onDelete,
}: {
  videos: StoredAudio[];
  loading: boolean;
  error?: string;
  deletingVideoId?: string;
  onDelete(videoId: string): void;
}) {
  if (loading) {
    return <LibraryMessage>Loading saved videos...</LibraryMessage>;
  }
  if (error) {
    return <LibraryMessage error>{error}</LibraryMessage>;
  }
  if (videos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-button-border bg-panel px-6 py-14 text-center shadow-sm">
        <Music2
          className="mx-auto mb-4 size-9 text-muted-foreground"
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold">No saved videos yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Choose replacement audio from a YouTube watch page and it will appear
          here.
        </p>
      </div>
    );
  }

  const sortedVideos = videos.toSorted(
    (left, right) => (right.savedAt ?? 0) - (left.savedAt ?? 0),
  );

  return (
    <div className="grid gap-3">
      <p className="mb-1 text-sm text-muted-foreground">
        {videos.length} {videos.length === 1 ? "video" : "videos"} using{" "}
        {formatBytes(
          videos.reduce((total, video) => total + getAudioSize(video), 0),
        )}
      </p>
      {sortedVideos.map((video) => (
        <SavedVideoRow
          key={video.videoId}
          video={video}
          deleting={deletingVideoId === video.videoId}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function SavedVideoRow({
  video,
  deleting,
  onDelete,
}: {
  video: StoredAudio;
  deleting: boolean;
  onDelete(videoId: string): void;
}) {
  const title = video.videoMetadata?.title || video.videoId;

  return (
    <article className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-panel p-4 shadow-sm">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-button text-muted-foreground">
        <Music2 className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h2 className="truncate font-semibold">{title}</h2>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {video.name} / {formatBytes(getAudioSize(video))}
          {video.savedAt ? ` / ${formatSavedAt(video.savedAt)}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-semibold text-white hover:opacity-90"
          href={`https://www.youtube.com/watch?v=${video.videoId}`}
          target="_blank"
          rel="noreferrer"
        >
          Open
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
        <button
          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md border border-button-border text-muted-foreground hover:bg-button-hover hover:text-error disabled:cursor-default disabled:opacity-50"
          type="button"
          aria-label={`Delete saved audio for ${title}`}
          disabled={deleting}
          onClick={() => {
            if (
              window.confirm(`Delete saved replacement audio for ${title}?`)
            ) {
              onDelete(video.videoId);
            }
          }}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function getAudioSize(audio: StoredAudio) {
  return audio.tracks.reduce((total, track) => total + track.blob.size, 0);
}

function LibraryMessage({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-panel p-6 text-sm shadow-sm ${error ? "border-error/40 text-error" : "border-border text-muted-foreground"}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

function formatSavedAt(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(timestamp);
}
