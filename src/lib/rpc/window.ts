import type {
  RpcCallbackInvoke,
  RpcClient,
  RpcRequest,
  RpcResponse,
} from "./core.ts";
import { createRpcProxy, deserializeParams, serializeParams } from "./core.ts";

export function createWindowRpc<Handlers>({
  targetWindow,
  targetOrigin,
  sourceWindow,
  sourceOrigin,
}: {
  targetWindow: Window;
  targetOrigin: string;
  sourceWindow: Window;
  sourceOrigin?: string;
}): RpcClient<Handlers> {
  return createRpcProxy<Handlers>((method, params) => {
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
            event.source !== sourceWindow ||
            (sourceOrigin && event.origin !== sourceOrigin)
          ) {
            return;
          }
          const message = event.data;
          if (message.type === "audio-replacement-window-rpc-callback") {
            if (message.requestId === id) {
              callbacks.get(message.callbackId)?.(...message.args);
            }
            return;
          }
          if (
            message.type === "audio-replacement-window-rpc-response" &&
            message.id === id
          ) {
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

      targetWindow.postMessage(
        {
          type: "audio-replacement-window-rpc-request",
          id,
          method,
          params: serializedParams,
        } satisfies RpcRequest,
        targetOrigin,
      );
    });
  });
}

export function registerWindowRpcHandlers(
  handlers: Record<string, (params: never) => Promise<unknown>>,
  {
    sourceWindow,
    targetWindow,
    targetOrigin,
  }: {
    sourceWindow: Window;
    targetWindow: Window;
    targetOrigin: string;
  },
) {
  window.addEventListener(
    "message",
    async (event: MessageEvent<RpcRequest>) => {
      if (
        event.source !== sourceWindow ||
        event.data?.type !== "audio-replacement-window-rpc-request"
      ) {
        return;
      }

      const { id, method, params } = event.data;
      const handler = handlers[method];
      if (!handler) {
        targetWindow.postMessage(
          {
            type: "audio-replacement-window-rpc-response",
            id,
            error: `Unknown method: ${method}`,
          } satisfies RpcResponse,
          targetOrigin,
        );
        return;
      }

      const deserializedParams = deserializeParams(
        params,
        (callbackId, args) => {
          targetWindow.postMessage(
            {
              type: "audio-replacement-window-rpc-callback",
              requestId: id,
              callbackId,
              args,
            } satisfies RpcCallbackInvoke,
            targetOrigin,
          );
        },
      );

      try {
        const result = await handler(deserializedParams as never);
        targetWindow.postMessage(
          {
            type: "audio-replacement-window-rpc-response",
            id,
            result,
          } satisfies RpcResponse,
          targetOrigin,
          collectTransferables(result),
        );
      } catch (error) {
        targetWindow.postMessage(
          {
            type: "audio-replacement-window-rpc-response",
            id,
            error: error instanceof Error ? error.message : String(error),
          } satisfies RpcResponse,
          targetOrigin,
        );
      }
    },
  );
}

function collectTransferables(value: unknown) {
  const transferables: Transferable[] = [];
  const seen = new WeakSet<object>();

  function visit(current: unknown) {
    if (current instanceof ArrayBuffer) {
      if (!transferables.includes(current)) {
        transferables.push(current);
      }
      return;
    }
    if (ArrayBuffer.isView(current) && current.buffer instanceof ArrayBuffer) {
      if (!transferables.includes(current.buffer)) {
        transferables.push(current.buffer);
      }
      return;
    }
    if (current === null || typeof current !== "object" || seen.has(current)) {
      return;
    }
    seen.add(current);
    for (const nested of Object.values(current)) {
      visit(nested);
    }
  }

  visit(value);
  return transferables;
}
