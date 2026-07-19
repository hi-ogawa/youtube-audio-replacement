import { IdbStore } from "./idb.ts";

export interface StoredAudioTrack {
  name: string;
  blob: Blob;
}

export interface StoredAudio {
  videoId: string;
  name: string;
  tracks: StoredAudioTrack[];
  videoTitle?: string;
  savedAt?: number;
}

interface LegacyStoredAudio {
  videoId: string;
  blob: Blob;
  name: string;
  videoTitle?: string;
  savedAt?: number;
}

export interface StoredMixerTrackState {
  volume: number;
  muted: boolean;
  soloed: boolean;
}

export type StoredMixerState = Record<string, StoredMixerTrackState>;

interface VideoState {
  panelOpen: boolean;
  mixer: StoredMixerState;
}

interface StoredVideoStates {
  videos: Record<string, VideoState>;
}

const VIDEO_STATE_KEY = "youtube-audio-replacement:video-state:v1";
const DEFAULT_VIDEO_STATE: VideoState = {
  panelOpen: false,
  mixer: {},
};

const audioStore = new IdbStore<StoredAudio | LegacyStoredAudio>({
  databaseName: "youtube-audio-replacement",
  storeName: "audio",
  version: 1,
  keyPath: "videoId",
});

function readVideoStates(): StoredVideoStates {
  try {
    const value = localStorage.getItem(VIDEO_STATE_KEY);
    if (value) {
      const stored = JSON.parse(value) as StoredVideoStates;
      if (stored.videos && typeof stored.videos === "object") {
        return stored;
      }
    }
  } catch {}
  return { videos: {} };
}

export const videoStorage = {
  getState(videoId: string): VideoState {
    return {
      ...DEFAULT_VIDEO_STATE,
      ...readVideoStates().videos[videoId],
    };
  },

  updateState(videoId: string, update: Partial<VideoState>): VideoState {
    const stored = readVideoStates();
    const state = {
      ...DEFAULT_VIDEO_STATE,
      ...stored.videos[videoId],
      ...update,
    };
    try {
      localStorage.setItem(
        VIDEO_STATE_KEY,
        JSON.stringify({
          videos: { ...stored.videos, [videoId]: state },
        } satisfies StoredVideoStates),
      );
    } catch {}
    return state;
  },
};

export const audioStorage = {
  async loadAudio(videoId: string): Promise<StoredAudio | null> {
    const stored = await audioStore.get(videoId);
    if (!stored || "tracks" in stored) {
      return stored;
    }
    return {
      videoId: stored.videoId,
      name: stored.name,
      videoTitle: stored.videoTitle,
      savedAt: stored.savedAt,
      tracks: [
        {
          name: stored.name,
          blob: stored.blob,
        },
      ],
    };
  },
  storeAudio: (audio: StoredAudio) => audioStore.put(audio),
};
