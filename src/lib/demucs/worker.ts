import { separate, type SeparateRequest } from "./separate.ts";
import type { WorkerResponse } from "./worker-client.ts";

self.onmessage = async (event: MessageEvent<SeparateRequest>) => {
  const post = (message: WorkerResponse, transfer?: Transferable[]) =>
    (self as unknown as Worker).postMessage(message, transfer ?? []);
  try {
    const outputs = await separate(event.data, (progress) =>
      post({ type: "progress", event: progress, at: Date.now() }),
    );
    post(
      { type: "done", outputs },
      outputs.flatMap((output) => [output.left.buffer, output.right.buffer]),
    );
  } catch (error) {
    post({ type: "error", message: String(error) });
  }
};
