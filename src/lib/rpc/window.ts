import type { RpcClient } from "./core.ts";
import { createRpcProxy, deserializeParams, serializeParams } from "./core.ts";
import type { RpcCallbackInvoke, RpcRequest, RpcResponse } from "./shared.ts";
import {
  WINDOW_RPC_CALLBACK,
  WINDOW_RPC_REQUEST,
  WINDOW_RPC_RESPONSE,
} from "./shared.ts";

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
          if (message.type === WINDOW_RPC_CALLBACK && "requestId" in message) {
            if (message.requestId === id) {
              callbacks.get(message.callbackId)?.(...message.args);
            }
            return;
          }
          if (
            message.type === WINDOW_RPC_RESPONSE &&
            "id" in message &&
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
          type: WINDOW_RPC_REQUEST,
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
  handlers: object,
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
        event.data?.type !== WINDOW_RPC_REQUEST
      ) {
        return;
      }

      const { id, method, params } = event.data;
      const handler = (handlers as any)[method];
      if (!handler) {
        targetWindow.postMessage(
          {
            type: WINDOW_RPC_RESPONSE,
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
              type: WINDOW_RPC_CALLBACK,
              requestId: id,
              callbackId,
              args,
            } satisfies RpcCallbackInvoke,
            targetOrigin,
          );
        },
      );

      try {
        const result = await Reflect.apply(handler, handlers, [
          deserializedParams,
        ]);
        targetWindow.postMessage(
          {
            type: WINDOW_RPC_RESPONSE,
            id,
            result,
          } satisfies RpcResponse,
          targetOrigin,
          collectTransferables(result),
        );
      } catch (error) {
        targetWindow.postMessage(
          {
            type: WINDOW_RPC_RESPONSE,
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
