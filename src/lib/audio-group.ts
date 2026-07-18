import type { ReplacementAudio } from "./player-sync.ts";
import type {
  MixerTrackState,
  StoredAudio,
  StoredAudioTrack,
} from "./storage.ts";

const DEFAULT_MIXER_TRACK: MixerTrackState = {
  volume: 100,
  muted: false,
  soloed: false,
};

export interface MixerTrack extends MixerTrackState {
  id: string;
  name: string;
  // `enabled` is the derived mixer output before master volume is applied.
  enabled: boolean;
}

export type Mixer = MixerTrack[];

interface AudioGroupNotifications {
  onTimeChange(currentTime: number): void;
  onDurationChange(duration: number | undefined): void;
}

export function createMixer(
  audio: StoredAudio | null | undefined,
  stored: Record<string, MixerTrackState>,
): Mixer {
  return deriveMixer(
    (audio?.tracks ?? []).map((track) => ({
      id: track.id,
      name: track.name,
      ...DEFAULT_MIXER_TRACK,
      ...stored[track.id],
    })),
  );
}

export function updateMixer(
  mixer: Mixer,
  trackId: string,
  update: Partial<MixerTrackState>,
): Mixer {
  return deriveMixer(
    mixer.map((track) =>
      track.id === trackId ? { ...track, ...update } : track,
    ),
  );
}

export function storeMixer(mixer: Mixer): Record<string, MixerTrackState> {
  return Object.fromEntries(
    mixer.map(({ id, volume, muted, soloed }) => [
      id,
      { volume, muted, soloed },
    ]),
  );
}

function deriveMixer(tracks: Omit<MixerTrack, "enabled">[]): Mixer {
  const anySoloed = tracks.some((track) => track.soloed);
  return tracks.map((track) => ({
    ...track,
    enabled: !track.muted && (!anySoloed || track.soloed),
  }));
}

export class AudioGroup implements ReplacementAudio {
  #masterVolume = 1;
  #players = new Map<string, { audio: HTMLAudioElement; objectUrl: string }>();
  #mixer: Mixer = [];

  get primary(): HTMLAudioElement | undefined {
    return this.#players.values().next().value?.audio;
  }

  get hasTracks(): boolean {
    return this.#players.size > 0;
  }

  get currentTime(): number {
    return this.primary?.currentTime ?? 0;
  }

  set currentTime(value: number) {
    for (const { audio } of this.#players.values()) {
      audio.currentTime = value;
    }
  }

  get playbackRate(): number {
    return this.primary?.playbackRate ?? 1;
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
      this.#players.set(track.id, { audio, objectUrl });
    }
    const primary = this.primary;
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

  setMixer(mixer: Mixer): void {
    this.#mixer = mixer;
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

  #applyMixer(): void {
    const mixer = new Map(this.#mixer.map((track) => [track.id, track]));
    for (const [id, { audio }] of this.#players) {
      const state = mixer.get(id);
      audio.volume = state?.enabled
        ? Math.max(0, Math.min(1, this.#masterVolume * (state.volume / 100)))
        : 0;
    }
  }
}
