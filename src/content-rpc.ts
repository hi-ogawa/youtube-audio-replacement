import type { acquisitionRpcHandlers } from "./acquisition.ts";
import type {
  RpcCallbackInvoke,
  RpcClient,
  RpcRequest,
  RpcResponse,
} from "./lib/rpc.ts";
import { createRpcProxy, once, serializeParams } from "./lib/rpc.ts";

type AcquisitionRpc = RpcClient<typeof acquisitionRpcHandlers>;

export const initContentRpc = once(
  () =>
    new Promise<AcquisitionRpc>((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube.com/embed/";
      iframe.hidden = true;

      const abortController = new AbortController();
      const timeout = window.setTimeout(() => {
        abortController.abort();
        iframe.remove();
        reject(new Error("Timed out while connecting to YouTube"));
      }, 15_000);

      iframe.addEventListener("error", () => {
        window.clearTimeout(timeout);
        abortController.abort();
        iframe.remove();
        reject(new Error("Could not load the hidden YouTube frame"));
      });

      window.addEventListener(
        "message",
        (event: MessageEvent) => {
          if (
            event.source !== iframe.contentWindow ||
            event.origin !== "https://www.youtube.com" ||
            event.data?.type !== "ytdl-ready"
          ) {
            return;
          }
          window.clearTimeout(timeout);
          abortController.abort();
          resolve(createIframeRpc(iframe));
        },
        { signal: abortController.signal },
      );

      document.body.appendChild(iframe);
    }),
);

function createIframeRpc(iframe: HTMLIFrameElement): AcquisitionRpc {
  return createRpcProxy<typeof acquisitionRpcHandlers>((method, params) => {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const abortController = new AbortController();
      const callbacks = new Map<string, (...args: unknown[]) => void>();
      const serializedParams = serializeParams(
        params,
        (callbackId, callback) => {
          callbacks.set(callbackId, callback);
        },
      );

      window.addEventListener(
        "message",
        (event: MessageEvent<RpcResponse | RpcCallbackInvoke>) => {
          if (
            event.source !== iframe.contentWindow ||
            event.origin !== "https://www.youtube.com"
          ) {
            return;
          }
          const message = event.data;
          if (message.type === "ytdl-callback-invoke") {
            if (message.requestId === id) {
              callbacks.get(message.callbackId)?.(...message.args);
            }
            return;
          }
          if (message.type === "ytdl-response" && message.id === id) {
            abortController.abort();
            if (message.error) {
              reject(new Error(message.error));
            } else {
              resolve(message.result);
            }
          }
        },
        { signal: abortController.signal },
      );

      iframe.contentWindow?.postMessage(
        {
          type: "ytdl-request",
          id,
          method,
          params: serializedParams,
        } satisfies RpcRequest,
        "https://www.youtube.com",
      );
    });
  });
}
