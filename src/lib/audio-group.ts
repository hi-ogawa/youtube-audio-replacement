import type { ReplacementAudio } from "./player-sync.ts";
import type { MixerTrackState, StoredAudioTrack } from "./storage.ts";

export class AudioGroup implements ReplacementAudio {
  #masterVolume = 1;
  #players = new Map<string, { audio: HTMLAudioElement; objectUrl: string }>();
  #mixer: Record<string, MixerTrackState> = {};

  get primary(): HTMLAudioElement | undefined {
    return this.#players.values().next().value?.audio;
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

  setTracks(tracks: StoredAudioTrack[]): void {
    this.clear();
    for (const track of tracks) {
      const audio = document.createElement("audio");
      const objectUrl = URL.createObjectURL(track.blob);
      audio.preload = "auto";
      audio.src = objectUrl;
      audio.load();
      this.#players.set(track.id, { audio, objectUrl });
    }
    this.#applyMixer();
  }

  setMixer(mixer: Record<string, MixerTrackState>): void {
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
    const anySoloed = Object.values(this.#mixer).some((track) => track.soloed);
    for (const [id, { audio }] of this.#players) {
      const state = this.#mixer[id];
      const audible = state && !state.muted && (!anySoloed || state.soloed);
      audio.volume = audible
        ? Math.max(0, Math.min(1, this.#masterVolume * (state.volume / 100)))
        : 0;
    }
  }
}
