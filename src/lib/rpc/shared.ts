export const WINDOW_RPC_REQUEST = "audio-replacement-window-rpc-request";
export const WINDOW_RPC_RESPONSE = "audio-replacement-window-rpc-response";
export const WINDOW_RPC_CALLBACK = "audio-replacement-window-rpc-callback";

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
