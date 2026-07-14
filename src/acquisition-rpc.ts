import type { acquisitionRpcHandlers } from "./acquisition.ts";
import type { RpcClient } from "./lib/rpc.ts";
import { once } from "./lib/rpc.ts";
import { createWindowRpc } from "./lib/window-rpc.ts";

type AcquisitionRpc = RpcClient<typeof acquisitionRpcHandlers>;

export const initAcquisitionRpc = once(
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
          const contentWindow = iframe.contentWindow;
          if (
            !contentWindow ||
            event.source !== contentWindow ||
            event.origin !== "https://www.youtube.com" ||
            event.data?.type !== "audio-replacement-acquisition-ready"
          ) {
            return;
          }
          window.clearTimeout(timeout);
          abortController.abort();
          resolve(
            createWindowRpc<typeof acquisitionRpcHandlers>({
              targetWindow: contentWindow,
              targetOrigin: "https://www.youtube.com",
              sourceWindow: contentWindow,
              sourceOrigin: "https://www.youtube.com",
            }),
          );
        },
        { signal: abortController.signal },
      );

      document.body.appendChild(iframe);
    }),
);
