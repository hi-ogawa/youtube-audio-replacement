import type { BackgroundRpcHandlers } from "./background.ts";
import { createRuntimeRelayRpc } from "./lib/rpc/runtime.ts";
import { EMBED_READY } from "./lib/rpc/shared.ts";
import { registerWindowRpcHandlers } from "./lib/rpc/window.ts";
import { fromBase64 } from "./lib/utils.ts";
import type { YouTubeStreamingFormat } from "./lib/youtube.ts";
import { fetchPlayerApi } from "./lib/youtube.ts";

const CHUNK_SIZE = 5_000_000;
const backgroundRpc = createRuntimeRelayRpc<BackgroundRpcHandlers>();

export type DownloadProgress = {
  bytesReceived: number;
  totalBytes: number;
};

async function proxyFetch(url: string): Promise<Uint8Array> {
  const { data } = await backgroundRpc.proxyFetch({ url });
  return fromBase64(data);
}

async function fetchPlayerApiWhenReady(videoId: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchPlayerApi(videoId);
    } catch (error) {
      if (
        attempt >= 100 ||
        !(error instanceof Error) ||
        error.message !== "Could not extract visitorData from ytcfg"
      ) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

async function resolveFormatUrl(videoId: string, itag: number) {
  const result = await fetchPlayerApiWhenReady(videoId);
  const format = result.streamingFormats.find(
    (candidate: YouTubeStreamingFormat) => candidate.itag === itag,
  );
  if (!format) {
    throw new Error(`Format itag ${itag} not found`);
  }
  return { result, format };
}

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
    const chunk = await proxyFetch(
      `${url}${separator}range=${offset}-${end - 1}`,
    );
    data.set(chunk, offset);
    offset += chunk.length;
    onProgress?.({ bytesReceived: offset, totalBytes: size });
  }

  return data;
}

export class EmbedContentRpcHandlers {
  async getStreamingFormats({ videoId }: { videoId: string }) {
    return await fetchPlayerApiWhenReady(videoId);
  }

  async downloadFormat({
    videoId,
    itag,
    onProgress,
  }: {
    videoId: string;
    itag: number;
    onProgress?: (progress: DownloadProgress) => void;
  }) {
    const { result, format } = await resolveFormatUrl(videoId, itag);
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
    };
  }
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
