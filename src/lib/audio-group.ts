import type { ReplacementAudio } from "./player-sync.ts";
import type {
  SelectedAudio,
  StoredAudioTrack,
  StoredMixerState,
  StoredMixerTrackState,
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
export type AudioPlaybackMode = "html-audio" | "web-audio";

interface AudioGroupNotifications {
  onTimeChange(currentTime: number): void;
  onDurationChange(duration: number | undefined): void;
}

interface AudioGroupBackend extends ReplacementAudio {
  hasTracks(): boolean;
  setTracks(
    tracks: StoredAudioTrack[],
    notifications: AudioGroupNotifications,
  ): Promise<void>;
  setMixerState(mixerState: MixerState): void;
  clear(): void;
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
  readonly mode: AudioPlaybackMode;
  readonly #backend: AudioGroupBackend;

  constructor(mode: AudioPlaybackMode = "html-audio") {
    this.mode = mode;
    this.#backend =
      mode === "web-audio" ? new WebAudioGroup() : new HtmlAudioGroup();
  }

  get currentTime(): number {
    return this.#backend.currentTime;
  }

  set currentTime(value: number) {
    this.#backend.currentTime = value;
  }

  get playbackRate(): number {
    return this.#backend.playbackRate;
  }

  set playbackRate(value: number) {
    this.#backend.playbackRate = value;
  }

  get volume(): number {
    return this.#backend.volume;
  }

  set volume(value: number) {
    this.#backend.volume = value;
  }

  hasTracks(): boolean {
    return this.#backend.hasTracks();
  }

  setTracks(
    tracks: StoredAudioTrack[],
    notifications: AudioGroupNotifications,
  ): Promise<void> {
    return this.#backend.setTracks(tracks, notifications);
  }

  setMixerState(mixerState: MixerState): void {
    this.#backend.setMixerState(mixerState);
  }

  play(): Promise<void> {
    return this.#backend.play();
  }

  pause(): void {
    this.#backend.pause();
  }

  clear(): void {
    this.#backend.clear();
  }
}

class HtmlAudioGroup implements AudioGroupBackend {
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

  async setTracks(
    tracks: StoredAudioTrack[],
    notifications: AudioGroupNotifications,
  ): Promise<void> {
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

class WebAudioGroup implements AudioGroupBackend {
  #context?: AudioContext;
  #generation = 0;
  #masterVolume = 1;
  #mixerState: MixerState = [];
  #tracks = new Map<string, { buffer: AudioBuffer; gain: GainNode }>();
  #sources = new Set<AudioBufferSourceNode>();
  #notifications?: AudioGroupNotifications;
  #currentTime = 0;
  #playbackRate = 1;
  #startedAt = 0;
  #playing = false;
  #timeUpdateTimer?: ReturnType<typeof setInterval>;

  get currentTime(): number {
    if (!this.#playing || !this.#context) {
      return this.#currentTime;
    }
    return (
      this.#currentTime +
      Math.max(0, this.#context.currentTime - this.#startedAt) *
        this.#playbackRate
    );
  }

  set currentTime(value: number) {
    this.#currentTime = Math.max(0, value);
    this.#notifications?.onTimeChange(this.#currentTime);
    if (this.#playing) {
      this.#startSources();
    }
  }

  get playbackRate(): number {
    return this.#playbackRate;
  }

  set playbackRate(value: number) {
    if (value === this.#playbackRate) {
      return;
    }
    this.#currentTime = this.currentTime;
    this.#playbackRate = value;
    if (this.#playing) {
      this.#startSources();
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
    return this.#tracks.size > 0;
  }

  async setTracks(
    tracks: StoredAudioTrack[],
    notifications: AudioGroupNotifications,
  ): Promise<void> {
    this.clear();
    const generation = this.#generation;
    const context = new AudioContext();
    this.#context = context;

    let decodedTracks: { name: string; buffer: AudioBuffer }[];
    try {
      decodedTracks = await Promise.all(
        tracks.map(async (track) => ({
          name: track.name,
          buffer: await context.decodeAudioData(await track.blob.arrayBuffer()),
        })),
      );
    } catch (error) {
      if (generation === this.#generation) {
        this.clear();
      }
      throw error;
    }
    if (generation !== this.#generation) {
      return;
    }

    this.#notifications = notifications;
    for (const track of decodedTracks) {
      const gain = context.createGain();
      gain.connect(context.destination);
      this.#tracks.set(track.name, { buffer: track.buffer, gain });
    }
    this.#applyMixer();
    notifications.onTimeChange(0);
    notifications.onDurationChange(this.#getPrimary()?.buffer.duration);
  }

  setMixerState(mixerState: MixerState): void {
    this.#mixerState = mixerState;
    this.#applyMixer();
  }

  async play(): Promise<void> {
    if (!this.#context || this.#tracks.size === 0) {
      return;
    }
    await this.#context.resume();
    if (this.#playing) {
      return;
    }
    this.#playing = true;
    this.#startSources();
    this.#timeUpdateTimer = setInterval(() => this.#updateTime(), 250);
  }

  pause(): void {
    if (this.#playing) {
      this.#currentTime = this.currentTime;
    }
    this.#playing = false;
    this.#stopSources();
    this.#stopTimeUpdates();
    this.#notifications?.onTimeChange(this.#currentTime);
  }

  clear(): void {
    this.#generation += 1;
    this.pause();
    for (const { gain } of this.#tracks.values()) {
      gain.disconnect();
    }
    this.#tracks.clear();
    this.#notifications = undefined;
    this.#currentTime = 0;
    if (this.#context) {
      void this.#context.close();
      this.#context = undefined;
    }
  }

  #getPrimary() {
    return this.#tracks.values().next().value as
      | { buffer: AudioBuffer; gain: GainNode }
      | undefined;
  }

  #startSources(): void {
    const context = this.#context;
    if (!context) {
      return;
    }

    this.#stopSources();
    const startAt = context.currentTime + 0.01;
    this.#startedAt = startAt;
    for (const { buffer, gain } of this.#tracks.values()) {
      if (this.#currentTime >= buffer.duration) {
        continue;
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = this.#playbackRate;
      source.connect(gain);
      source.start(startAt, this.#currentTime);
      this.#sources.add(source);
    }
  }

  #stopSources(): void {
    for (const source of this.#sources) {
      source.stop();
      source.disconnect();
    }
    this.#sources.clear();
  }

  #updateTime(): void {
    const duration = this.#getPrimary()?.buffer.duration;
    let currentTime = this.currentTime;
    if (duration !== undefined && currentTime >= duration) {
      this.#currentTime = duration;
      currentTime = duration;
      this.#playing = false;
      this.#stopSources();
      this.#stopTimeUpdates();
    }
    this.#notifications?.onTimeChange(currentTime);
  }

  #stopTimeUpdates(): void {
    if (this.#timeUpdateTimer) {
      clearInterval(this.#timeUpdateTimer);
      this.#timeUpdateTimer = undefined;
    }
  }

  #applyMixer(): void {
    const mixer = new Map(this.#mixerState.map((track) => [track.name, track]));
    for (const [name, { gain }] of this.#tracks) {
      const state = mixer.get(name);
      gain.gain.value = state?.enabled
        ? Math.max(0, this.#masterVolume * (state.volume / 100))
        : 0;
    }
  }
}
