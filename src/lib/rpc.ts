// Adapted from https://github.com/hi-ogawa/yt-dlp-ext/blob/main/src/lib/rpc.ts
export interface RpcRequest {
  type: "ytdl-request";
  id: string;
  method: string;
  params: unknown;
}

export interface RpcResponse {
  type: "ytdl-response";
  id: string;
  result?: unknown;
  error?: string;
}

interface RpcCallbackStub {
  __rpcCallback: string;
}

export interface RpcCallbackInvoke {
  type: "ytdl-callback-invoke";
  requestId: string;
  callbackId: string;
  args: unknown[];
}

type AnyFn = (...args: any[]) => void;

export function serializeParams(
  params: unknown,
  register: (id: string, fn: AnyFn) => void,
): unknown {
  if (typeof params === "function") {
    const id = crypto.randomUUID();
    register(id, params as AnyFn);
    return { __rpcCallback: id } satisfies RpcCallbackStub;
  }
  if (Array.isArray(params)) {
    return params.map((value) => serializeParams(value, register));
  }
  if (params !== null && typeof params === "object") {
    return Object.fromEntries(
      Object.entries(params as Record<string, unknown>).map(([key, value]) => [
        key,
        serializeParams(value, register),
      ]),
    );
  }
  return params;
}

export function deserializeParams(
  params: unknown,
  invoke: (callbackId: string, args: unknown[]) => void,
): unknown {
  if (
    params !== null &&
    typeof params === "object" &&
    "__rpcCallback" in params &&
    typeof (params as RpcCallbackStub).__rpcCallback === "string"
  ) {
    const id = (params as RpcCallbackStub).__rpcCallback;
    return (...args: unknown[]) => invoke(id, args);
  }
  if (Array.isArray(params)) {
    return params.map((value) => deserializeParams(value, invoke));
  }
  if (params !== null && typeof params === "object") {
    return Object.fromEntries(
      Object.entries(params as Record<string, unknown>).map(([key, value]) => [
        key,
        deserializeParams(value, invoke),
      ]),
    );
  }
  return params;
}

type HandlerParams<Handler> = Handler extends (
  params: infer Params,
) => Promise<unknown>
  ? Params
  : never;

type HandlerResult<Handler> = Handler extends (
  ...args: never[]
) => Promise<infer Result>
  ? Result
  : never;

export type RpcClient<Handlers> = {
  [Method in keyof Handlers]: (
    params: HandlerParams<Handlers[Method]>,
  ) => Promise<HandlerResult<Handlers[Method]>>;
};

export function createRpcProxy<Handlers>(
  call: (method: string, params: unknown) => Promise<unknown>,
): RpcClient<Handlers> {
  return new Proxy({} as RpcClient<Handlers>, {
    get(_target, property) {
      if (
        typeof property !== "string" ||
        property === "then" ||
        property === "toJSON"
      ) {
        return undefined;
      }
      return (params: unknown) => call(property, params);
    },
  });
}

export function once<T>(fn: () => T): () => T {
  let result: { value: T } | undefined;
  return () => {
    result ??= { value: fn() };
    return result.value;
  };
}
