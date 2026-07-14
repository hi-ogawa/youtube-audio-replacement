import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { resolveAudioFile } from "./audio-file.ts";
import { PlayerSync, type VideoSyncSource } from "./player-sync.ts";
import { type StoredAudio, videoStorage } from "./storage.ts";

export function StoredPanel({
  videoId,
  getVideo,
  onError,
}: {
  videoId: string;
  getVideo: () => VideoSyncSource | undefined;
  onError(message: string): void;
}) {
  const storedAudioQuery = useSuspenseQuery({
    queryKey: ["stored-audio", videoId],
    queryFn: async () => {
      try {
        return await videoStorage.loadAudio(videoId);
      } catch (error) {
        console.error(error);
        onError("Saved audio is unavailable. You can still choose a file.");
        return null;
      }
    },
  });

  const storeAudioMutation = useMutation({
    mutationFn: videoStorage.storeAudio,
    onError: (error) => {
      console.error(error);
      onError("Audio is available for this session but could not be saved.");
    },
  });

  return (
    <Panel
      videoId={videoId}
      getVideo={getVideo}
      initialSelectedAudio={storedAudioQuery.data}
      onSelectAudio={storeAudioMutation.mutate}
      onError={onError}
    />
  );
}

export function Panel({
  videoId,
  getVideo,
  initialSelectedAudio,
  onSelectAudio,
  onError,
}: {
  videoId: string;
  getVideo: () => VideoSyncSource | undefined;
  initialSelectedAudio: StoredAudio | null;
  onSelectAudio(audio: StoredAudio): void;
  onError(message: string): void;
}) {
  const [selectedAudio, setSelectedAudio] = useState(
    initialSelectedAudio ?? undefined,
  );
  const [volume, setVolume] = useState(100);
  const [enabled, setEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>();
  const [duration, setDuration] = useState<number>();
  const audioRef = useRef<HTMLAudioElement>(null);
  const syncRef = useRef<PlayerSync>(null);

  // The detached player and its event wiring live for the panel's lifetime, so
  // this effect owns both setup and teardown as one external resource.
  useEffect(() => {
    const audio = document.createElement("audio");
    audio.preload = "auto";
    audio.volume = volume / 100;
    audioRef.current = audio;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : undefined);
    };
    const updateVolume = () => setVolume(Math.round(audio.volume * 100));
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("volumechange", updateVolume);

    return () => {
      syncRef.current?.destroy();
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("volumechange", updateVolume);
      audio.removeAttribute("src");
      audio.load();
    };
  }, []);

  // The source can come from initial storage or a later upload. Synchronizing
  // it here keeps Blob URL replacement and cleanup in one lifecycle owner.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !selectedAudio) {
      return;
    }

    const objectUrl = URL.createObjectURL(selectedAudio.blob);
    audio.src = objectUrl;
    audio.load();
    setCurrentTime(0);
    setDuration(undefined);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedAudio?.blob]);

  const chooseFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const audioFile = await resolveAudioFile(file);
      syncRef.current?.destroy();
      syncRef.current = null;
      const nextAudio = {
        videoId,
        blob: audioFile,
        name: audioFile.name,
      };
      setSelectedAudio(nextAudio);
      onSelectAudio(nextAudio);
      setEnabled(false);
    },
    onError: (error) => {
      console.error(error);
      onError(
        error instanceof Error ? error.message : "Could not read audio file.",
      );
    },
  });

  function toggle() {
    const sync = syncRef.current;
    if (sync?.enabled) {
      sync.destroy();
      syncRef.current = null;
      setEnabled(false);
      return;
    }

    const video = getVideo();
    const audio = audioRef.current;
    if (!video || !audio) {
      onError("YouTube video player not found.");
      return;
    }

    const nextSync = new PlayerSync(video, audio, {
      onError(error) {
        console.error(error);
        onError("Replacement audio playback failed.");
      },
    });
    nextSync.enable();
    syncRef.current = nextSync;
    setEnabled(true);
  }

  function changeVolume(nextVolume: number) {
    setVolume(nextVolume);
    if (audioRef.current) {
      audioRef.current.volume = nextVolume / 100;
    }
  }

  return (
    <div className="w-75 rounded-lg border border-border bg-panel p-2.5 text-sm text-foreground shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">Audio replacement</div>
        <Toggle
          checked={enabled}
          disabled={!selectedAudio}
          onChange={toggle}
        />
      </div>
      <AudioDrop
        audio={selectedAudio}
        currentTime={currentTime}
        duration={duration}
        onChoose={chooseFileMutation.mutate}
      />
      <label className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Volume</span>
        <input
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-accent disabled:cursor-default disabled:opacity-45"
          type="range"
          min="0"
          max="100"
          step="1"
          value={volume}
          disabled={!selectedAudio}
          aria-label="Replacement audio volume"
          onChange={(event) => changeVolume(Number(event.target.value))}
        />
        <span className="w-9 text-right font-mono tabular-nums">{volume}%</span>
      </label>
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange(): void;
}) {
  return (
    <button
      className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground disabled:cursor-default disabled:opacity-45"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Use replacement audio"
      disabled={disabled}
      onClick={onChange}
    >
      <span>{checked ? "On" : "Off"}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-accent" : "bg-button"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`}
        />
      </span>
    </button>
  );
}

function AudioDrop({
  audio,
  currentTime,
  duration,
  onChoose,
}: {
  audio: StoredAudio | undefined;
  currentTime: number | undefined;
  duration: number | undefined;
  onChoose(file: File): void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        className={`mt-2.5 flex h-13 w-full cursor-pointer items-center gap-2 rounded-md border px-2.5 text-left transition-colors ${audio ? "border-button-border bg-button hover:bg-button-hover" : "border-dashed border-button-border text-muted-foreground hover:border-accent-border hover:bg-button-hover"} ${dragging ? "border-accent-border bg-button-hover" : ""}`}
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) {
            onChoose(file);
          }
        }}
      >
        <svg
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18V5l10-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="16" cy="16" r="3" />
        </svg>
        {audio ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-foreground">
                {audio.name}
              </span>
              <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              Change
            </span>
          </>
        ) : (
          <span className="text-xs">
            Drop audio or a stem ZIP, or{" "}
            <span className="text-foreground">browse</span>
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.zip,application/zip"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onChoose(file);
          }
          event.target.value = "";
        }}
      />
    </>
  );
}

export function Fab({
  open,
  shifted = false,
  onClick,
}: {
  open: boolean;
  shifted?: boolean;
  onClick(): void;
}) {
  const label = open
    ? "Hide audio replacement controls"
    : "Show audio replacement controls";

  return (
    <button
      className={`pointer-events-auto fixed bottom-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-0 shadow-lg ${shifted ? "right-15" : "right-3"} ${open ? "bg-accent text-white" : "bg-foreground text-panel"}`}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <svg
        aria-hidden="true"
        className="size-7"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 5 6 9H2v6h4l5 4V5Z" />
        <path d="M15 9.5a4 4 0 0 1 0 5" />
        <path d="M18 7a7 7 0 0 1 0 10" />
      </svg>
    </button>
  );
}

function formatTime(seconds: number | undefined) {
  if (seconds === undefined || !Number.isFinite(seconds)) {
    return "--:--";
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function ErrorPanel({
  message,
  onClose,
}: {
  message: string;
  onClose(): void;
}) {
  return (
    <div
      className="pointer-events-auto flex w-75 items-start gap-2 rounded-lg border border-error/40 bg-panel p-2 text-xs text-error shadow-lg"
      role="alert"
    >
      <span className="min-w-0 flex-1">{message}</span>
      <button
        className="shrink-0 cursor-pointer rounded p-0.5 text-error hover:bg-button-hover"
        type="button"
        aria-label="Dismiss error"
        onClick={onClose}
      >
        <svg
          aria-hidden="true"
          className="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </svg>
      </button>
    </div>
  );
}
