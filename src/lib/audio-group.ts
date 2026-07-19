import type { ReplacementAudio } from "./player-sync.ts";
import type {
  SelectedAudio,
  StoredMixerState,
  StoredMixerTrackState,
  StoredAudioTrack,
} from "./storage.ts";

const DEFAULT_MIXER_TRACK_STATE: StoredMixerTrackState = {
  volume: 100,
  muted: false,
  soloed: false,
};

export interface MixerTrackState extends StoredMixerTrackState {
  name: string;
  // `enabled` is the derived mixer output before master volume is applied.
  enabled: boolean;
}

export type MixerState = MixerTrackState[];

interface AudioGroupNotifications {
  onTimeChange(currentTime: number): void;
  onDurationChange(duration: number | undefined): void;
}

export function createMixerState(
  audio: SelectedAudio | undefined,
  stored: StoredMixerState,
): MixerState {
  return deriveMixerState(
    (audio?.tracks ?? []).map((track) => ({
      name: track.name,
      ...DEFAULT_MIXER_TRACK_STATE,
      ...stored[track.name],
    })),
  );
}

export function updateMixerState(
  mixerState: MixerState,
  trackName: string,
  update: Partial<StoredMixerTrackState>,
): MixerState {
  return deriveMixerState(
    mixerState.map((track) =>
      track.name === trackName ? { ...track, ...update } : track,
    ),
  );
}

export function toStoredMixerState(mixerState: MixerState): StoredMixerState {
  return Object.fromEntries(
    mixerState.map(({ name, volume, muted, soloed }) => [
      name,
      { volume, muted, soloed },
    ]),
  );
}

function deriveMixerState(
  tracks: Omit<MixerTrackState, "enabled">[],
): MixerState {
  const anySoloed = tracks.some((track) => track.soloed);
  return tracks.map((track) => ({
    ...track,
    enabled: !track.muted && (!anySoloed || track.soloed),
  }));
}

export class AudioGroup implements ReplacementAudio {
  #masterVolume = 1;
  #players = new Map<string, { audio: HTMLAudioElement; objectUrl: string }>();
  #mixerState: MixerState = [];

  get currentTime(): number {
    return this.#getPrimary()?.currentTime ?? 0;
  }

  set currentTime(value: number) {
    for (const { audio } of this.#players.values()) {
      audio.currentTime = value;
    }
  }

  get playbackRate(): number {
    return this.#getPrimary()?.playbackRate ?? 1;
  }

  set playbackRate(value: number) {
    for (const { audio } of this.#players.values()) {
      audio.playbackRate = value;
    }
  }

  get volume(): number {
    return this.#masterVolume;
  }

  set volume(value: number) {
    this.#masterVolume = value;
    this.#applyMixer();
  }

  hasTracks(): boolean {
    return this.#players.size > 0;
  }

  setTracks(
    tracks: StoredAudioTrack[],
    notifications: AudioGroupNotifications,
  ): void {
    this.clear();
    for (const track of tracks) {
      const audio = document.createElement("audio");
      const objectUrl = URL.createObjectURL(track.blob);
      audio.preload = "auto";
      audio.src = objectUrl;
      audio.load();
      this.#players.set(track.name, { audio, objectUrl });
    }
    const primary = this.#getPrimary();
    if (primary) {
      const updateDuration = () => {
        notifications.onDurationChange(
          Number.isFinite(primary.duration) ? primary.duration : undefined,
        );
      };
      primary.addEventListener("timeupdate", () =>
        notifications.onTimeChange(primary.currentTime),
      );
      primary.addEventListener("loadedmetadata", updateDuration);
      primary.addEventListener("durationchange", updateDuration);
    }
    this.#applyMixer();
  }

  setMixerState(mixerState: MixerState): void {
    this.#mixerState = mixerState;
    this.#applyMixer();
  }

  async play(): Promise<void> {
    await Promise.all(
      [...this.#players.values()].map(({ audio }) => audio.play()),
    );
  }

  pause(): void {
    for (const { audio } of this.#players.values()) {
      audio.pause();
    }
  }

  clear(): void {
    for (const { audio, objectUrl } of this.#players.values()) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(objectUrl);
    }
    this.#players.clear();
  }

  #getPrimary(): HTMLAudioElement | undefined {
    return this.#players.values().next().value?.audio;
  }

  #applyMixer(): void {
    const mixer = new Map(this.#mixerState.map((track) => [track.name, track]));
    for (const [name, { audio }] of this.#players) {
      const state = mixer.get(name);
      audio.volume = state?.enabled
        ? Math.max(0, Math.min(1, this.#masterVolume * (state.volume / 100)))
        : 0;
    }
  }
}
