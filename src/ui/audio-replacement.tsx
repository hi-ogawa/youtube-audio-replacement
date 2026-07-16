import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { resolveAudioFiles } from "../lib/audio-file.ts";
import { AudioGroup } from "../lib/audio-group.ts";
import { PlayerSync, type VideoSyncSource } from "../lib/player-sync.ts";
import {
  type MixerTrackState,
  type StoredAudio,
  videoStorage,
} from "../lib/storage.ts";

export function StoredPanel({
  videoId,
  getVideo,
  onError,
  onGenerate,
}: {
  videoId: string;
  getVideo: () => VideoSyncSource | undefined;
  onError(message: string): void;
  onGenerate(): void;
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
  initialSelectedAudio: StoredAudio | null;
  onSelectAudio(audio: StoredAudio): void;
  onError(message: string): void;
  onGenerate(): void;
}) {
  const [selectedAudio, setSelectedAudio] = useState(
    initialSelectedAudio ?? undefined,
  );
  const [mixer, setMixer] = useState(() =>
    createMixer(initialSelectedAudio, videoStorage.getState(videoId).mixer),
  );
  const [enabled, setEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>();
  const [duration, setDuration] = useState<number>();
  const [audioGroup] = useState(() => new AudioGroup());
  const syncRef = useRef<PlayerSync>(null);

  useEffect(() => {
    return () => {
      syncRef.current?.destroy();
      audioGroup.clear();
    };
  }, [audioGroup]);

  // The first track supplies display metadata. AudioGroup owns all player and
  // object URL cleanup, including when this source is replaced.
  useEffect(() => {
    if (!selectedAudio) {
      audioGroup.clear();
      return;
    }

    audioGroup.setTracks(selectedAudio.tracks);
    const audio = audioGroup.primary;
    if (!audio) {
      return;
    }

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : undefined);
    };
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    setCurrentTime(0);
    setDuration(undefined);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
    };
  }, [audioGroup, selectedAudio]);

  useEffect(() => {
    audioGroup.setMixer(mixer);
  }, [audioGroup, mixer]);

  const chooseFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const resolved = await resolveAudioFiles(file);
      syncRef.current?.destroy();
      syncRef.current = null;
      const nextAudio = {
        videoId,
        name: resolved.name,
        tracks: resolved.tracks.map((track) => ({
          id: track.id,
          name: track.name,
          blob: track.file,
        })),
      };
      const nextMixer = createMixer(nextAudio, {});
      setSelectedAudio(nextAudio);
      setMixer(nextMixer);
      videoStorage.updateState(videoId, { mixer: nextMixer });
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
    if (!video || !audioGroup.primary) {
      onError("YouTube video player not found.");
      return;
    }

    const nextSync = new PlayerSync(video, audioGroup, {
      onError(error) {
        console.error(error);
        onError("Replacement audio playback failed.");
      },
    });
    nextSync.enable();
    syncRef.current = nextSync;
    setEnabled(true);
  }

  function updateMixerTrack(trackId: string, update: Partial<MixerTrackState>) {
    setMixer((current) => {
      const next = {
        ...current,
        [trackId]: { ...current[trackId], ...update },
      };
      videoStorage.updateState(videoId, { mixer: next });
      return next;
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
        onChoose={chooseFileMutation.mutate}
      />
      {selectedAudio && selectedAudio.tracks.length > 1 ? (
        <TrackMixer
          tracks={selectedAudio.tracks}
          mixer={mixer}
          onChange={updateMixerTrack}
        />
      ) : (
        <SingleTrackVolume
          trackId={selectedAudio?.tracks[0]?.id}
          volume={
            selectedAudio
              ? (mixer[selectedAudio.tracks[0].id]?.volume ?? 100)
              : 100
          }
          onChange={(trackId, volume) => updateMixerTrack(trackId, { volume })}
        />
      )}
    </div>
  );
}

function SingleTrackVolume({
  trackId,
  volume,
  onChange,
}: {
  trackId: string | undefined;
  volume: number;
  onChange(trackId: string, volume: number): void;
}) {
  return (
    <label className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
      <span>Volume</span>
      <input
        className="h-1.5 min-w-0 flex-1 cursor-pointer accent-accent disabled:cursor-default disabled:opacity-45"
        type="range"
        min="0"
        max="100"
        step="1"
        value={volume}
        disabled={!trackId}
        aria-label="Replacement audio volume"
        onChange={(event) => {
          if (trackId) {
            onChange(trackId, Number(event.target.value));
          }
        }}
      />
      <span className="w-9 text-right font-mono tabular-nums">{volume}%</span>
    </label>
  );
}

function TrackMixer({
  tracks,
  mixer,
  onChange,
}: {
  tracks: StoredAudio["tracks"];
  mixer: Record<string, MixerTrackState>;
  onChange(trackId: string, update: Partial<MixerTrackState>): void;
}) {
  const anySoloed = Object.values(mixer).some((track) => track.soloed);

  return (
    <div className="mt-2.5">
      {tracks.map((track) => {
        const state = mixer[track.id] ?? DEFAULT_MIXER_TRACK;
        const effectivelyMuted = state.muted || (anySoloed && !state.soloed);
        return (
          <div
            className={`flex items-center gap-1.5 border-t border-border py-2 ${effectivelyMuted ? "text-muted-foreground" : ""}`}
            key={track.id}
          >
            <span
              className="w-12 shrink-0 truncate text-xs font-semibold"
              title={track.id}
            >
              {track.name}
            </span>
            <input
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-accent"
              type="range"
              min="0"
              max="100"
              step="1"
              value={state.volume}
              aria-label={`${track.name} volume`}
              onChange={(event) =>
                onChange(track.id, { volume: Number(event.target.value) })
              }
            />
            <span className="w-8 shrink-0 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
              {state.volume}%
            </span>
            <MixerButton
              label={`Mute ${track.name}`}
              pressed={state.muted}
              onClick={() => onChange(track.id, { muted: !state.muted })}
            >
              M
            </MixerButton>
            <MixerButton
              label={`Solo ${track.name}`}
              pressed={state.soloed}
              accent
              onClick={() => onChange(track.id, { soloed: !state.soloed })}
            >
              S
            </MixerButton>
          </div>
        );
      })}
    </div>
  );
}

function MixerButton({
  label,
  pressed,
  accent = false,
  children,
  onClick,
}: {
  label: string;
  pressed: boolean;
  accent?: boolean;
  children: string;
  onClick(): void;
}) {
  return (
    <button
      className={`flex size-6 shrink-0 cursor-pointer items-center justify-center rounded border text-[10px] font-bold ${
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
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const DEFAULT_MIXER_TRACK: MixerTrackState = {
  volume: 100,
  muted: false,
  soloed: false,
};

function createMixer(
  audio: StoredAudio | null | undefined,
  stored: Record<string, MixerTrackState>,
): Record<string, MixerTrackState> {
  return Object.fromEntries(
    (audio?.tracks ?? []).map((track) => [
      track.id,
      { ...DEFAULT_MIXER_TRACK, ...stored[track.id] },
    ]),
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
        aria-label="Replacement audio file"
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
