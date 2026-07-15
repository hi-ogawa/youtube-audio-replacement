import type { BackgroundRpcHandlers } from "./background.ts";
import { createRuntimeRelayRpc } from "./lib/rpc/runtime.ts";
import { EMBED_READY } from "./lib/rpc/shared.ts";
import { registerWindowRpcHandlers } from "./lib/rpc/window.ts";
import { fromBase64 } from "./lib/utils.ts";
import { fetchPlayerApi, selectAudioFormat } from "./lib/youtube.ts";

const backgroundRpc = createRuntimeRelayRpc<BackgroundRpcHandlers>();

export class EmbedContentRpcHandlers {
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

const CHUNK_SIZE = 5_000_000;

export type DownloadProgress = {
  bytesReceived: number;
  totalBytes: number;
};

async function proxyFetch(url: string): Promise<Uint8Array> {
  const { data } = await backgroundRpc.proxyFetch({ url });
  return fromBase64(data);
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

function main() {
  registerWindowRpcHandlers(new EmbedContentRpcHandlers(), {
    sourceWindow: window.parent,
    targetWindow: window.parent,
    targetOrigin: "*",
  });

  window.parent.postMessage({ type: EMBED_READY }, "*");
}

main();
