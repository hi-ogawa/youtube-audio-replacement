import { toBase64 } from "./lib/base64.ts";
import { registerRuntimeHandlers } from "./lib/extension-rpc.ts";

export const backgroundRpcHandlers = {
  async openGenerator({ videoId }: { videoId: string }) {
    if (!/^[\w-]{11}$/.test(videoId)) {
      throw new Error("Invalid YouTube video ID");
    }
    const url = new URL(chrome.runtime.getURL("index.html"));
    url.searchParams.set("videoId", videoId);
    await chrome.tabs.create({ url: url.href });
  },

  async proxyFetch({ url }: { url: string }) {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.protocol !== "https:" ||
      !(
        parsedUrl.hostname === "googlevideo.com" ||
        parsedUrl.hostname.endsWith(".googlevideo.com")
      )
    ) {
      throw new Error("Proxy fetch only supports Googlevideo URLs");
    }

    const response = await fetch(parsedUrl);
    if (!response.ok) {
      throw new Error(`Proxy fetch failed: ${response.status}`);
    }
    return {
      data: toBase64(new Uint8Array(await response.arrayBuffer())),
    };
  },
};

registerRuntimeHandlers(backgroundRpcHandlers);
