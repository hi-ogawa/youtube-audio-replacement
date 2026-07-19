import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { formatTrackName, resolveAudioFiles } from "../lib/audio-file.ts";
import {
  AudioGroup,
  createMixerState,
  type MixerState,
  type MixerTrackState,
  toStoredMixerState,
  updateMixerState,
} from "../lib/audio-group.ts";
import { PlayerSync, type VideoSyncSource } from "../lib/player-sync.ts";
import {
  type SelectedAudio,
  type StoredMixerTrackState,
  videoStorage,
} from "../lib/storage.ts";

export function StoredPanel({
  videoId,
  getVideo,
  onError,
  onGenerate,
  loadAudio,
  storeAudio,
}: {
  videoId: string;
  getVideo: () => VideoSyncSource | undefined;
  onError(message: string): void;
  onGenerate(): void;
  loadAudio(): Promise<SelectedAudio | undefined>;
  storeAudio(audio: SelectedAudio): Promise<void>;
}) {
  const storedAudioQuery = useSuspenseQuery({
    queryKey: ["stored-audio", videoId],
    queryFn: async () => {
      try {
        return (await loadAudio()) ?? null;
      } catch (error) {
        console.error(error);
        onError("Saved audio is unavailable. You can still choose a file.");
        return null;
      }
    },
  });

  const storeAudioMutation = useMutation({
    mutationFn: storeAudio,
    onError: (error) => {
      console.error(error);
      onError("Audio is available for this session but could not be saved.");
    },
  });

  return (
    <Panel
      videoId={videoId}
      getVideo={getVideo}
      initialSelectedAudio={storedAudioQuery.data ?? undefined}
      onSelectAudio={storeAudioMutation.mutate}
      onError={onError}
      onGenerate={onGenerate}
    />
  );
}

export function Panel({
  videoId,
  getVideo,
  initialSelectedAudio,
  onSelectAudio,
  onError,
  onGenerate,
}: {
  videoId: string;
  getVideo: () => VideoSyncSource | undefined;
  initialSelectedAudio?: SelectedAudio;
  onSelectAudio(audio: SelectedAudio): void;
  onError(message: string): void;
  onGenerate(): void;
}) {
  const [selectedAudio, setSelectedAudio] = useState(initialSelectedAudio);
  const [mixerState, setMixerState] = useState(() =>
    createMixerState(
      initialSelectedAudio,
      videoStorage.getState(videoId).mixer,
    ),
  );
  const [enabled, setEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>();
  const [duration, setDuration] = useState<number>();
  const [audioGroup] = useState(() => new AudioGroup());
  const [playerSync] = useState(
    () =>
      new PlayerSync({
        onError(error) {
          console.error(error);
          onError("Replacement audio playback failed.");
        },
      }),
  );

  useEffect(() => () => playerSync.disable(), [playerSync]);
  useEffect(() => () => audioGroup.clear(), [audioGroup]);

  // The first track supplies display metadata. AudioGroup owns all player and
  // object URL cleanup, including when this source is replaced.
  useEffect(() => {
    if (!selectedAudio) {
      audioGroup.clear();
      return;
    }

    // Install the source's mixer before creating players. Mixer-only changes
    // are applied synchronously in updateMixerTrack.
    audioGroup.setMixerState(mixerState);
    audioGroup.setTracks(selectedAudio.tracks, {
      onTimeChange: setCurrentTime,
      onDurationChange: setDuration,
    });
    setCurrentTime(0);
    setDuration(undefined);
  }, [audioGroup, selectedAudio]);

  const chooseFileMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const resolved = await resolveAudioFiles(files);
      playerSync.disable();
      const nextAudio = {
        videoId,
        name: resolved.name,
        tracks: resolved.tracks.map((track) => ({
          name: track.name,
          blob: track.file,
        })),
      };
      const nextMixerState = createMixerState(nextAudio, {});
      setSelectedAudio(nextAudio);
      setMixerState(nextMixerState);
      videoStorage.updateState(videoId, {
        mixer: toStoredMixerState(nextMixerState),
      });
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
    if (playerSync.isEnabled()) {
      playerSync.disable();
      setEnabled(false);
      return;
    }

    const video = getVideo();
    if (!video || !audioGroup.hasTracks()) {
      onError("YouTube video player not found.");
      return;
    }

    playerSync.enable(video, audioGroup);
    setEnabled(true);
  }

  function updateMixerTrack(
    trackName: string,
    update: Partial<StoredMixerTrackState>,
  ) {
    const nextMixerState = updateMixerState(mixerState, trackName, update);
    audioGroup.setMixerState(nextMixerState);
    setMixerState(nextMixerState);
    videoStorage.updateState(videoId, {
      mixer: toStoredMixerState(nextMixerState),
    });
  }

  return (
    <div className="w-75 rounded-lg border border-border bg-panel p-2.5 text-sm text-foreground shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">Stem mixer</div>
        {!selectedAudio ? (
          <button
            className="h-5 cursor-pointer rounded-full bg-accent px-2.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-border"
            type="button"
            onClick={onGenerate}
          >
            Prepare stems
          </button>
        ) : (
          <Toggle
            checked={enabled}
            disabled={!selectedAudio}
            onChange={toggle}
          />
        )}
      </div>
      <AudioDrop
        audio={selectedAudio}
        currentTime={currentTime}
        duration={duration}
        loading={chooseFileMutation.isPending}
        onChoose={chooseFileMutation.mutate}
      />
      {selectedAudio && (
        <Mixer
          mixerState={mixerState}
          disabled={!enabled}
          onChange={updateMixerTrack}
        />
      )}
    </div>
  );
}

function Mixer({
  mixerState,
  disabled,
  onChange,
}: {
  mixerState: MixerState;
  disabled: boolean;
  onChange(trackName: string, update: Partial<StoredMixerTrackState>): void;
}) {
  return (
    <div className="mt-2.5">
      {mixerState.map((track) => (
        <MixerTrackRow
          key={track.name}
          track={track}
          disabled={disabled}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function MixerTrackRow({
  track,
  disabled,
  onChange,
}: {
  track: MixerTrackState;
  disabled: boolean;
  onChange(trackName: string, update: Partial<StoredMixerTrackState>): void;
}) {
  const displayName = formatTrackName(track.name);
  const trackDisabled = !disabled && !track.enabled;

  return (
    <div
      className={`flex items-center gap-1.5 border-t border-border py-2 first:border-t-0 first:pt-0.5 last:pb-0 ${trackDisabled ? "text-muted-foreground" : ""}`}
    >
      <span
        className="w-12 shrink-0 truncate text-xs font-semibold"
        title={track.name}
      >
        {displayName}
      </span>
      <input
        // TODO: Add explicit dark-mode styling for Chromium's native disabled range.
        className="h-1.5 min-w-0 flex-1 cursor-pointer accent-accent disabled:cursor-default dark:disabled:opacity-65"
        type="range"
        min="0"
        max="100"
        step="1"
        value={track.volume}
        aria-label={`${displayName} volume`}
        disabled={disabled}
        onChange={(event) =>
          onChange(track.name, { volume: Number(event.target.value) })
        }
      />
      <span className="w-8 shrink-0 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
        {track.volume}%
      </span>
      <MixerButton
        label={`Mute ${displayName}`}
        pressed={track.muted}
        disabled={disabled}
        onClick={() => onChange(track.name, { muted: !track.muted })}
      >
        M
      </MixerButton>
      <MixerButton
        label={`Solo ${displayName}`}
        pressed={track.soloed}
        disabled={disabled}
        accent
        onClick={() => onChange(track.name, { soloed: !track.soloed })}
      >
        S
      </MixerButton>
    </div>
  );
}

function MixerButton({
  label,
  pressed,
  disabled,
  accent = false,
  children,
  onClick,
}: {
  label: string;
  pressed: boolean;
  disabled: boolean;
  accent?: boolean;
  children: string;
  onClick(): void;
}) {
  return (
    <button
      className={`flex size-6 shrink-0 cursor-pointer items-center justify-center rounded border text-[10px] font-bold disabled:cursor-default disabled:opacity-60 ${
        pressed
          ? accent
            ? "border-accent bg-accent text-white"
            : "border-foreground bg-foreground text-panel"
          : "border-button-border bg-button text-foreground hover:bg-button-hover"
      }`}
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
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
  loading,
  onChoose,
}: {
  audio: SelectedAudio | undefined;
  currentTime: number | undefined;
  duration: number | undefined;
  loading: boolean;
  onChoose(files: File[]): void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        className={`mt-2.5 flex h-13 w-full cursor-pointer items-center gap-2 rounded-md border px-2.5 text-left transition-colors disabled:cursor-wait disabled:opacity-70 ${audio ? "border-button-border bg-button hover:bg-button-hover" : "border-dashed border-button-border text-muted-foreground hover:border-accent-border hover:bg-button-hover"} ${dragging ? "border-accent-border bg-button-hover" : ""}`}
        type="button"
        disabled={loading}
        aria-busy={loading}
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
          const files = [...event.dataTransfer.files];
          if (files.length > 0) {
            onChoose(files);
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
        {loading ? (
          <span className="text-xs" role="status" aria-live="polite">
            Loading audio...
          </span>
        ) : audio ? (
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
            Drop audio files or a stem ZIP, or{" "}
            <span className="text-foreground">browse</span>
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        aria-label="Replacement audio file"
        type="file"
        accept="audio/*,.zip,application/zip"
        multiple
        disabled={loading}
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (files.length > 0) {
            onChoose(files);
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
  const label = open ? "Hide stem mixer controls" : "Show stem mixer controls";

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
        className="size-8"
        viewBox="0 0 128 128"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M24 67h10l6-20 10 39 10-58 10 72 10-53 8 29 6-18h10" />
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
