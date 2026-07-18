export interface VideoSyncSource extends EventTarget {
  currentTime: number;
  muted: boolean;
  paused: boolean;
  playbackRate: number;
  readonly volume: number;
}

export interface ReplacementAudio {
  currentTime: number;
  playbackRate: number;
  volume: number;
  play(): Promise<void>;
  pause(): void;
}

export class PlayerSync {
  #video?: VideoSyncSource;
  #audio?: ReplacementAudio;
  #originalMuted = false;
  readonly #onError: (error: unknown) => void;

  constructor({ onError }: { onError: (error: unknown) => void }) {
    this.#onError = onError;
  }

  isEnabled(): boolean {
    return Boolean(this.#video);
  }

  enable(video: VideoSyncSource, audio: ReplacementAudio) {
    if (this.#video === video && this.#audio === audio) {
      return;
    }

    this.disable();
    this.#video = video;
    this.#audio = audio;
    video.addEventListener("play", this.#onPlay);
    video.addEventListener("pause", this.#onPause);
    video.addEventListener("seeking", this.#onSeeking);
    video.addEventListener("seeked", this.#onSeeked);
    video.addEventListener("ratechange", this.#onRateChange);

    this.#originalMuted = video.muted;
    this.#alignTime();
    this.#alignRate();
    audio.volume = this.#originalMuted ? 0 : video.volume;
    video.muted = true;

    if (!video.paused) {
      void this.#play();
    }
  }

  disable() {
    const video = this.#video;
    const audio = this.#audio;
    if (!video || !audio) {
      return;
    }

    audio.pause();
    video.muted = this.#originalMuted;
    video.removeEventListener("play", this.#onPlay);
    video.removeEventListener("pause", this.#onPause);
    video.removeEventListener("seeking", this.#onSeeking);
    video.removeEventListener("seeked", this.#onSeeked);
    video.removeEventListener("ratechange", this.#onRateChange);
    this.#video = undefined;
    this.#audio = undefined;
  }

  #onPlay = () => {
    if (!this.isEnabled()) {
      return;
    }
    this.#alignTime();
    this.#alignRate();
    void this.#play();
  };

  #onPause = () => {
    this.#audio?.pause();
  };

  #onSeeking = () => {
    if (this.#video) {
      this.#alignTime();
    }
  };

  #onSeeked = () => {
    if (!this.isEnabled()) {
      return;
    }
    this.#alignTime();
    if (this.#video!.paused) {
      this.#audio!.pause();
    } else {
      void this.#play();
    }
  };

  #onRateChange = () => {
    if (this.#video) {
      this.#alignRate();
    }
  };

  #alignTime() {
    this.#audio!.currentTime = this.#video!.currentTime;
  }

  #alignRate() {
    this.#audio!.playbackRate = this.#video!.playbackRate;
  }

  async #play() {
    try {
      await this.#audio!.play();
    } catch (error) {
      this.#onError(error);
    }
  }
}
