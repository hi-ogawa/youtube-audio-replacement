// Adapted from https://github.com/hi-ogawa/yt-dlp-ext/blob/main/src/content.ts
import { EMBED_READY } from "./lib/rpc/shared.ts";
import { registerWindowRpcHandlers } from "./lib/rpc/window.ts";
import {
  fetchPlayerApi,
  getVisitorData,
  selectAudioFormat,
} from "./lib/youtube.ts";

export class EmbedContentRpcHandlers {
  async ready(_params: Record<string, never>) {
    if (document.readyState !== "complete") {
      await new Promise<void>((resolve) =>
        window.addEventListener("load", () => resolve(), { once: true }),
      );
    }
    if (!getVisitorData()) {
      throw new Error("Could not extract visitorData from ytcfg");
    }
  }

  async download({
    videoId,
    onProgress,
  }: {
    videoId: string;
    onProgress?: (progress: DownloadProgress) => void;
  }) {
    const result = await fetchPlayerApi(videoId);
    const format = selectAudioFormat(result.streamingFormats);
    if (!format) {
      throw new Error(
        "No complete audio-only format is available for this video.",
      );
    }
    if (!format.contentLength) {
      throw new Error("Unknown file size");
    }
    const data = await downloadBytes(
      format.url,
      format.contentLength,
      onProgress,
    );
    const mimeType = format.mimeType.split(";")[0] ?? "audio/webm";
    const extension = mimeType.split("/")[1] ?? "webm";
    const title = result.video.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
    return {
      data: data.buffer as ArrayBuffer,
      filename: `${title}.${extension}`,
      mimeType,
      video: result.video,
    };
  }
}

const CHUNK_SIZE = 65_536;

export type DownloadProgress = {
  bytesReceived: number;
  totalBytes: number;
};

async function downloadBytes(
  url: string,
  size: number,
  onProgress?: (progress: DownloadProgress) => void,
) {
  const data = new Uint8Array(size);
  let offset = 0;

  while (offset < size) {
    const end = Math.min(offset + CHUNK_SIZE, size);
    const separator = url.includes("?") ? "&" : "?";
    const response = await fetch(
      `${url}${separator}range=${offset}-${end - 1}`,
    );
    if (!response.ok) {
      throw new Error(`Audio download failed: ${response.status}`);
    }
    const chunk = new Uint8Array(await response.arrayBuffer());
    if (chunk.length === 0) {
      throw new Error("Audio download returned no data");
    }
    if (chunk.length > end - offset) {
      throw new Error("Audio download returned too much data");
    }
    data.set(chunk, offset);
    offset += chunk.length;
    onProgress?.({ bytesReceived: offset, totalBytes: size });
  }

  return data;
}

function main() {
  registerWindowRpcHandlers(new EmbedContentRpcHandlers(), {
    sourceWindow: window.parent,
    targetWindow: window.parent,
    targetOrigin: "*",
  });

  window.parent.postMessage({ type: EMBED_READY }, "*");
}

main();
