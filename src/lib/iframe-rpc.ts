import type { RpcClient } from "./rpc.ts";
import { createWindowRpc } from "./window-rpc.ts";

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
    iframe.src = src;
    iframe.hidden = true;

    const abortController = new AbortController();
    const timeout = window.setTimeout(() => {
      abortController.abort();
      iframe.remove();
      reject(new Error(`Timed out while connecting to ${origin}`));
    }, timeoutMs);

    iframe.addEventListener("error", () => {
      window.clearTimeout(timeout);
      abortController.abort();
      iframe.remove();
      reject(new Error(`Could not load the hidden frame from ${origin}`));
    });

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
