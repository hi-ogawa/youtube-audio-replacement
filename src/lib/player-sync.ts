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
  enabled = false;
  #originalMuted = false;
  readonly #onError: (error: unknown) => void;

  constructor(
    private readonly video: VideoSyncSource,
    private readonly audio: ReplacementAudio,
    { onError = console.error }: { onError?: (error: unknown) => void } = {},
  ) {
    this.#onError = onError;
    video.addEventListener("play", this.#onPlay);
    video.addEventListener("pause", this.#onPause);
    video.addEventListener("seeking", this.#onSeeking);
    video.addEventListener("seeked", this.#onSeeked);
    video.addEventListener("ratechange", this.#onRateChange);
  }

  enable() {
    if (this.enabled) {
      return;
    }

    this.enabled = true;
    this.#originalMuted = this.video.muted;
    this.#alignTime();
    this.#alignRate();
    this.audio.volume = this.#originalMuted ? 0 : this.video.volume;
    this.video.muted = true;

    if (!this.video.paused) {
      void this.#play();
    }
  }

  disable() {
    if (!this.enabled) {
      return;
    }

    this.enabled = false;
    this.audio.pause();
    this.video.muted = this.#originalMuted;
  }

  destroy() {
    this.disable();
    this.video.removeEventListener("play", this.#onPlay);
    this.video.removeEventListener("pause", this.#onPause);
    this.video.removeEventListener("seeking", this.#onSeeking);
    this.video.removeEventListener("seeked", this.#onSeeked);
    this.video.removeEventListener("ratechange", this.#onRateChange);
  }

  #onPlay = () => {
    if (!this.enabled) {
      return;
    }
    this.#alignTime();
    this.#alignRate();
    void this.#play();
  };

  #onPause = () => {
    if (this.enabled) {
      this.audio.pause();
    }
  };

  #onSeeking = () => {
    if (this.enabled) {
      this.#alignTime();
    }
  };

  #onSeeked = () => {
    if (!this.enabled) {
      return;
    }
    this.#alignTime();
    if (this.video.paused) {
      this.audio.pause();
    } else {
      void this.#play();
    }
  };

  #onRateChange = () => {
    if (this.enabled) {
      this.#alignRate();
    }
  };

  #alignTime() {
    this.audio.currentTime = this.video.currentTime;
  }

  #alignRate() {
    this.audio.playbackRate = this.video.playbackRate;
  }

  async #play() {
    try {
      await this.audio.play();
    } catch (error) {
      this.#onError(error);
    }
  }
}
