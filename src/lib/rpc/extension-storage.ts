import type { BackgroundRpcHandlers } from "../../background.ts";
import type { ExtensionStorageRpcHandlers } from "../../extension-storage-page.ts";
import type { RpcClient } from "./core.ts";
import { createWindowRpc } from "./window.ts";

export async function createExtensionStorageRpc(
  backgroundRpc: RpcClient<BackgroundRpcHandlers>,
): Promise<RpcClient<ExtensionStorageRpcHandlers>> {
  const { url } = await backgroundRpc.getExtensionStorageUrl({});
  return new Promise<RpcClient<ExtensionStorageRpcHandlers>>(
    (resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.hidden = true;
      iframe.src = url;
      const timeout = window.setTimeout(() => {
        iframe.remove();
        reject(new Error("Extension storage frame did not load"));
      }, 15_000);
      iframe.addEventListener("load", () => {
        window.clearTimeout(timeout);
        if (!iframe.contentWindow) {
          reject(new Error("Extension storage frame is unavailable"));
          return;
        }
        resolve(
          createWindowRpc<ExtensionStorageRpcHandlers>({
            targetWindow: iframe.contentWindow,
            targetOrigin: "*",
            sourceWindow: iframe.contentWindow,
          }),
        );
      });
      iframe.addEventListener("error", () => {
        window.clearTimeout(timeout);
        iframe.remove();
        reject(new Error("Extension storage frame could not be loaded"));
      });
      document.body.appendChild(iframe);
    },
  );
}
