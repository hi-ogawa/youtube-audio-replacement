import {
  Download,
  EllipsisVertical,
  ExternalLink,
  LoaderCircle,
  Music2,
  Trash2,
} from "lucide-react";
import type { StoredAudio } from "../lib/storage.ts";
import { formatBytes } from "../lib/utils.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./components/dropdown-menu.tsx";

export function SavedVideosView({
  videos,
  loading,
  error,
  deletingVideoId,
  downloadingVideoId,
  onDelete,
  onDownload,
}: {
  videos: StoredAudio[];
  loading: boolean;
  error?: string;
  deletingVideoId?: string;
  downloadingVideoId?: string;
  onDelete(videoId: string): void;
  onDownload(video: StoredAudio): void;
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
          downloading={downloadingVideoId === video.videoId}
          onDelete={onDelete}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}

function SavedVideoRow({
  video,
  deleting,
  downloading,
  onDelete,
  onDownload,
}: {
  video: StoredAudio;
  deleting: boolean;
  downloading: boolean;
  onDelete(videoId: string): void;
  onDownload(video: StoredAudio): void;
}) {
  const title = video.videoMetadata?.title || video.videoId;

  return (
    <article className="group relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-panel p-4 shadow-sm transition-colors hover:border-button-border hover:bg-button-hover focus-within:border-accent-border">
      <a
        className="absolute inset-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-border"
        href={`https://www.youtube.com/watch?v=${video.videoId}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${title} on YouTube`}
      />
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-button text-muted-foreground">
        <Music2 className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h2 className="flex items-center gap-1.5 truncate font-semibold">
          <span className="truncate">{title}</span>
          <ExternalLink
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </h2>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {video.name} / {formatBytes(getAudioSize(video))}
          {video.savedAt ? ` / ${formatSavedAt(video.savedAt)}` : ""}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="relative z-10 flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-button hover:text-foreground"
            type="button"
            aria-label={`Actions for ${title}`}
          >
            <EllipsisVertical className="size-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48" align="end">
          <DropdownMenuItem
            disabled={downloading}
            onSelect={() => onDownload(video)}
          >
            {downloading ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            {downloading ? "Creating ZIP..." : "Download tracks"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-error focus:text-error"
            disabled={deleting}
            onSelect={() => {
              if (
                window.confirm(`Delete saved replacement audio for ${title}?`)
              ) {
                onDelete(video.videoId);
              }
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete saved audio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
