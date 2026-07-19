// Adapted from https://github.com/hi-ogawa/yt-dlp-ext/blob/main/src/content-rpc.ts
import type { RpcClient } from "./core.ts";
import { createWindowRpc } from "./window.ts";

export function createHiddenIframeRpc<Handlers>({
  src,
  origin,
  readyMessage,
  timeoutMs,
}: {
  src: string;
  origin: string;
  readyMessage: string;
  timeoutMs: number;
}): Promise<RpcClient<Handlers>> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("credentialless", "");
    iframe.src = src;
    iframe.hidden = true;

    const abortController = new AbortController();
    const timeout = window.setTimeout(() => {
      abortController.abort();
      iframe.remove();
      reject(new Error(`Timed out while connecting to ${origin}`));
    }, timeoutMs);

    iframe.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        abortController.abort();
        iframe.remove();
        reject(new Error(`Could not load the hidden frame from ${origin}`));
      },
      { signal: abortController.signal },
    );

    window.addEventListener(
      "message",
      (event: MessageEvent) => {
        const contentWindow = iframe.contentWindow;
        if (
          !contentWindow ||
          event.source !== contentWindow ||
          event.origin !== origin ||
          event.data?.type !== readyMessage
        ) {
          return;
        }
        window.clearTimeout(timeout);
        abortController.abort();
        resolve(
          createWindowRpc<Handlers>({
            targetWindow: contentWindow,
            targetOrigin: origin,
            sourceWindow: contentWindow,
            sourceOrigin: origin,
          }),
        );
      },
      { signal: abortController.signal },
    );

    document.body.appendChild(iframe);
  });
}

export function createHiddenIframeRpcOnLoad<Handlers>({
  src,
  timeoutMs,
}: {
  src: string;
  timeoutMs: number;
}): Promise<RpcClient<Handlers>> {
  // Use this for same-extension pages whose handlers are registered before the
  // document load event. Cross-origin embeds need createHiddenIframeRpc because
  // their content-script handlers announce readiness separately.
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.hidden = true;
    iframe.src = src;

    const timeout = window.setTimeout(() => {
      iframe.remove();
      reject(new Error("Hidden frame did not load"));
    }, timeoutMs);

    iframe.addEventListener("load", () => {
      window.clearTimeout(timeout);
      if (!iframe.contentWindow) {
        reject(new Error("Hidden frame is unavailable"));
        return;
      }
      resolve(
        createWindowRpc<Handlers>({
          targetWindow: iframe.contentWindow,
          targetOrigin: "*",
          sourceWindow: iframe.contentWindow,
        }),
      );
    });
    iframe.addEventListener("error", () => {
      window.clearTimeout(timeout);
      iframe.remove();
      reject(new Error("Hidden frame could not be loaded"));
    });
    document.body.appendChild(iframe);
  });
}
