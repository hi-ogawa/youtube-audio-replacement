import { registerWindowRpcHandlers } from "./lib/rpc/window.ts";
import { audioStorage, type StoredAudio } from "./lib/storage.ts";

export class StoragePageRpcHandlers {
  loadAudio({ videoId }: { videoId: string }) {
    return audioStorage.loadAudio(videoId);
  }

  storeAudio({ audio }: { audio: StoredAudio }) {
    return audioStorage.storeAudio(audio);
  }
}

function main() {
  registerWindowRpcHandlers(new StoragePageRpcHandlers(), {
    sourceWindow: window.parent,
    targetWindow: window.parent,
    targetOrigin: "https://www.youtube.com",
  });
}

main();
