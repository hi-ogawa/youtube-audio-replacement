import { registerWindowRpcHandlers } from "./lib/rpc/window.ts";
import { audioStorage, type StoredAudio } from "./lib/storage.ts";

export class ExtensionStorageRpcHandlers {
  loadAudio({ videoId }: { videoId: string }) {
    return audioStorage.loadAudio(videoId);
  }

  storeAudio({ audio }: { audio: StoredAudio }) {
    return audioStorage.storeAudio(audio);
  }
}

function main() {
  // MAIN-world page code already had access to YouTube-origin IndexedDB. This
  // bridge changes the storage origin, not the page-origin trust boundary.
  registerWindowRpcHandlers(new ExtensionStorageRpcHandlers(), {
    sourceWindow: window.parent,
    targetWindow: window.parent,
    targetOrigin: "https://www.youtube.com",
  });
}

main();
