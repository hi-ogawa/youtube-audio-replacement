// Adapted from https://github.com/hi-ogawa/yt-dlp-ext/blob/main/src/lib/rpc.ts
export const WINDOW_RPC_REQUEST = "audio-replacement-window-rpc-request";
export const WINDOW_RPC_RESPONSE = "audio-replacement-window-rpc-response";
export const WINDOW_RPC_CALLBACK = "audio-replacement-window-rpc-callback";
export const RUNTIME_RPC_REQUEST = "audio-replacement-runtime-rpc";
export const RUNTIME_RELAY_REQUEST = "audio-replacement-relay-request";
export const RUNTIME_RELAY_RESPONSE = "audio-replacement-relay-response";
export const EMBED_READY = "audio-replacement-embed-ready";

export interface RpcRequest {
  type: string;
  id: string;
  method: string;
  params: unknown;
}

export interface RpcResponse {
  type: string;
  id: string;
  result?: unknown;
  error?: string;
}

export interface RpcCallbackInvoke {
  type: string;
  requestId: string;
  callbackId: string;
  args: unknown[];
}

export interface RuntimeRequest {
  type: string;
  id: string;
  method: string;
  params: unknown;
}

export interface RuntimeResponse {
  result?: unknown;
  error?: string;
}

export interface RelayRequest extends Omit<RuntimeRequest, "type"> {
  type: string;
}

export interface RelayResponse extends RuntimeResponse {
  type: string;
  id: string;
}
