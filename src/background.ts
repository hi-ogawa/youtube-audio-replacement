// Adapted from https://github.com/hi-ogawa/yt-dlp-ext/blob/main/src/background.ts
import { registerRuntimeHandlers } from "./lib/rpc/runtime.ts";
import { parseVideoId } from "./lib/youtube.ts";

export class BackgroundRpcHandlers {
  async openGenerator({ videoId }: { videoId: string }) {
    if (parseVideoId(videoId) !== videoId) {
      throw new Error("Invalid YouTube video ID");
    }
    await openGenerator(videoId);
  }

  async getExtensionStorageUrl(_params: Record<string, never>) {
    return {
      url: chrome.runtime.getURL("src/extension-storage.html"),
    };
  }
}

async function openGenerator(videoId?: string) {
  const url = new URL(chrome.runtime.getURL("index.html"));
  if (videoId) {
    url.searchParams.set("videoId", videoId);
  }
  await chrome.tabs.create({ url: url.href });
}

function main() {
  chrome.action.onClicked.addListener((tab) => {
    void openGenerator(parseVideoId(tab.url ?? ""));
  });
  registerRuntimeHandlers(new BackgroundRpcHandlers());
}

main();
