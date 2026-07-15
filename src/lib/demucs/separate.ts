import init, {
  separate as separateWasm,
  type Host,
} from "@hiogawa/demucs-onnx-wasm";
import ortWasmModuleUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import * as ort from "onnxruntime-web/wasm";
import type { SeparationConfiguration } from "./models.ts";
import {
  readModelFile,
  type ModelFilename,
  type ModelSource,
} from "./models.ts";

const MODEL_SEGMENT = 343_980;
const MODEL_INPUT_LENGTH = 2 * MODEL_SEGMENT;
const MODEL_OUTPUT_LENGTH = 4 * 2 * MODEL_SEGMENT;

ort.env.wasm.wasmPaths = { mjs: ortWasmModuleUrl, wasm: ortWasmUrl };

export interface SeparateRequest extends SeparationConfiguration {
  left: Float32Array;
  right: Float32Array;
  modelSource: ModelSource;
}

export interface SeparatedStem {
  name: string;
  left: Float32Array;
  right: Float32Array;
}

export type ProgressEvent =
  | { type: "started"; total: number }
  | {
      type: "model-loading";
      index: number;
      total: number;
      chunks: number;
      file: string;
    }
  | { type: "model-loaded" | "model-complete" | "finalizing" | "finalized" }
  | {
      type: "inference";
      done: number;
      total: number;
      memberDone: number;
      memberTotal: number;
      shift: number;
      shifts: number;
    };

export async function separate(
  request: SeparateRequest,
  onProgress?: (event: ProgressEvent) => void,
): Promise<SeparatedStem[]> {
  const wasm = await init();
  let dft: Uint8Array | undefined;
  const host: Host = {
    event(...event) {
      switch (event[0]) {
        case "started":
          onProgress?.({ type: event[0], total: event[1] });
          break;
        case "model-loading":
          onProgress?.({
            type: event[0],
            index: event[1],
            total: event[2],
            chunks: event[3],
            file: event[4],
          });
          break;
        case "inference":
          onProgress?.({
            type: event[0],
            done: event[1],
            total: event[2],
            memberDone: event[3],
            memberTotal: event[4],
            shift: event[5],
            shifts: event[6],
          });
          break;
        default:
          onProgress?.({ type: event[0] });
      }
    },
    async initialize() {
      dft = await readModelFile(request.modelSource, "dft.bin");
    },
    async loadModel(model, source) {
      if (!dft) {
        throw new Error("Demucs host is not initialized");
      }
      const filename = (
        source ? `${model}_${source}.onnx` : `${model}.onnx`
      ) as ModelFilename;
      const bytes = await readModelFile(request.modelSource, filename);
      return ort.InferenceSession.create(bytes, {
        executionProviders: ["wasm"],
        externalData: [{ data: dft, path: "dft.bin" }],
      });
    },
    async runModel(session, inputPointer, outputPointer) {
      const input = new Float32Array(
        wasm.memory.buffer,
        inputPointer,
        MODEL_INPUT_LENGTH,
      );
      const result = await (session as ort.InferenceSession).run({
        input: new ort.Tensor("float32", input, [1, 2, MODEL_SEGMENT]),
      });
      new Float32Array(
        wasm.memory.buffer,
        outputPointer,
        MODEL_OUTPUT_LENGTH,
      ).set(result.output.data as Float32Array);
    },
    async releaseModel(session) {
      await (session as ort.InferenceSession).release();
    },
  };

  const tracks = await separateWasm(
    request.model,
    request.twoStems ?? undefined,
    request.twoStems ? request.method : undefined,
    request.shifts,
    request.left,
    request.right,
    host,
  );
  const stemOrder = request.twoStems
    ? [
        { name: "backing", index: 1 },
        { name: request.twoStems, index: 0 },
      ]
    : [
        { name: "vocals", index: 3 },
        { name: "drums", index: 0 },
        { name: "bass", index: 1 },
        { name: "other", index: 2 },
      ];
  return stemOrder.map(({ name, index }) => ({
    name,
    left: tracks[2 * index],
    right: tracks[2 * index + 1],
  }));
}
