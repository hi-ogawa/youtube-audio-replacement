// Typed MAIN-world -> isolated-world -> background service worker RPC.
import { createRpcProxy, type RpcClient } from "./core.ts";
import type { RelayRequest, RelayResponse, RuntimeRequest } from "./shared.ts";
import {
  RUNTIME_RELAY_REQUEST,
  RUNTIME_RELAY_RESPONSE,
  RUNTIME_RPC_REQUEST,
} from "./shared.ts";

export function createRuntimeRelayRpc<Handlers>(): RpcClient<Handlers> {
  return createRpcProxy<Handlers>((method, params) => {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const abortController = new AbortController();
      window.addEventListener(
        "message",
        (event: MessageEvent<RelayResponse>) => {
          if (
            event.source !== window ||
            event.data?.type !== RUNTIME_RELAY_RESPONSE ||
            event.data.id !== id
          ) {
            return;
          }
          abortController.abort();
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.result);
          }
        },
        { signal: abortController.signal },
      );
      window.postMessage(
        {
          type: RUNTIME_RELAY_REQUEST,
          id,
          method,
          params,
        } satisfies RelayRequest,
        "*",
      );
    });
  });
}

export function setupRuntimeRelay() {
  window.addEventListener(
    "message",
    async (event: MessageEvent<RelayRequest>) => {
      if (
        event.source !== window ||
        event.data?.type !== RUNTIME_RELAY_REQUEST
      ) {
        return;
      }
      const { id, method, params } = event.data;
      try {
        const response = await chrome.runtime.sendMessage({
          type: RUNTIME_RPC_REQUEST,
          id,
          method,
          params,
        } satisfies RuntimeRequest);
        window.postMessage(
          {
            type: RUNTIME_RELAY_RESPONSE,
            id,
            ...response,
          } satisfies RelayResponse,
          "*",
        );
      } catch (error) {
        window.postMessage(
          {
            type: RUNTIME_RELAY_RESPONSE,
            id,
            error: error instanceof Error ? error.message : String(error),
          } satisfies RelayResponse,
          "*",
        );
      }
    },
  );
}

export function registerRuntimeHandlers(
  handlers: Record<string, (params: never) => Promise<unknown>>,
) {
  chrome.runtime.onMessage.addListener(
    (message: RuntimeRequest, _sender, sendResponse) => {
      if (message.type !== RUNTIME_RPC_REQUEST) {
        return;
      }
      const handler = handlers[message.method];
      if (!handler) {
        return;
      }
      handler(message.params as never).then(
        (result) => sendResponse({ result }),
        (error: unknown) =>
          sendResponse({
            error: error instanceof Error ? error.message : String(error),
          }),
      );
      return true;
    },
  );
}
