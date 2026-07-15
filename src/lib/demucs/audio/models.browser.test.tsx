import { expect, test } from "vitest";
import { requiredModelFiles } from "./models.ts";

test("selects the optimized bass-practice model files", () => {
  expect(requiredModelFiles("htdemucs_ft", "bass", "minus")).toEqual([
    "dft.bin",
    "htdemucs_ft_bass.onnx",
  ]);
});

test("requires all specialists for fine-tuned four-stem output", () => {
  expect(requiredModelFiles("htdemucs_ft")).toEqual([
    "dft.bin",
    "htdemucs_ft_drums.onnx",
    "htdemucs_ft_bass.onnx",
    "htdemucs_ft_other.onnx",
    "htdemucs_ft_vocals.onnx",
  ]);
});
