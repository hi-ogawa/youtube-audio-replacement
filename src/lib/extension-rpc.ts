// Typed MAIN-world -> isolated-world -> background service worker RPC.
import { createRpcProxy, type RpcClient } from "./rpc.ts";

type RuntimeRequest = {
  type: "audio-replacement-runtime-rpc";
  id: string;
  method: string;
  params: unknown;
};

type RuntimeResponse = {
  result?: unknown;
  error?: string;
};

type RelayRequest = Omit<RuntimeRequest, "type"> & {
  type: "audio-replacement-relay-request";
};

type RelayResponse = RuntimeResponse & {
  type: "audio-replacement-relay-response";
  id: string;
};

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
            event.data?.type !== "audio-replacement-relay-response" ||
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
          type: "audio-replacement-relay-request",
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
        event.data?.type !== "audio-replacement-relay-request"
      ) {
        return;
      }
      const { id, method, params } = event.data;
      try {
        const response = await chrome.runtime.sendMessage({
          type: "audio-replacement-runtime-rpc",
          id,
          method,
          params,
        } satisfies RuntimeRequest);
        window.postMessage(
          {
            type: "audio-replacement-relay-response",
            id,
            ...response,
          } satisfies RelayResponse,
          "*",
        );
      } catch (error) {
        window.postMessage(
          {
            type: "audio-replacement-relay-response",
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
      if (message.type !== "audio-replacement-runtime-rpc") {
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
