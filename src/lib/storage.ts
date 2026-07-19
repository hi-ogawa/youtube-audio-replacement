import { IdbStore } from "./idb.ts";

// These abstractions run in different origins. videoStorage is called by the
// YouTube MAIN-world content script, so its localStorage belongs to youtube.com.
// audioStorage is called by extension-storage-page.ts, so its IndexedDB belongs
// to the extension origin and is shared by extension pages.

export interface StoredAudioTrack {
  name: string;
  blob: Blob;
}

export interface SelectedAudio {
  videoId: string;
  name: string;
  tracks: StoredAudioTrack[];
}

export interface StoredVideoMetadata {
  title?: string;
  channelName?: string;
  durationSeconds?: number;
}

export interface StoredAudio extends SelectedAudio {
  videoMetadata?: StoredVideoMetadata;
  savedAt?: number;
}

export interface StoredAudioSummary {
  videoId: string;
  name: string;
  size: number;
  videoMetadata?: StoredVideoMetadata;
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

const audioStore = new IdbStore<StoredAudio>({
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
  loadAudio: (videoId: string) => audioStore.get(videoId),
  storeAudio: (audio: StoredAudio) => audioStore.put(audio),
  async listAudio(): Promise<StoredAudioSummary[]> {
    return (await audioStore.getAll())
      .map((audio) => ({
        videoId: audio.videoId,
        name: audio.name,
        size: audio.tracks.reduce((total, track) => total + track.blob.size, 0),
        videoMetadata: audio.videoMetadata,
        savedAt: audio.savedAt,
      }))
      .sort((left, right) => (right.savedAt ?? 0) - (left.savedAt ?? 0));
  },
  deleteAudio: (videoId: string) => audioStore.delete(videoId),
};
