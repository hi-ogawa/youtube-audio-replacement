const MODEL_FILENAMES = [
  "dft.bin",
  "htdemucs.onnx",
  "htdemucs_ft_drums.onnx",
  "htdemucs_ft_bass.onnx",
  "htdemucs_ft_other.onnx",
  "htdemucs_ft_vocals.onnx",
] as const;

const MODEL_RELEASE_TAG = "models-2026-07-11";

export type DemucsModel = "htdemucs" | "htdemucs_ft";
export type StemSource = "drums" | "bass" | "other" | "vocals";
export type TwoStemMethod = "add" | "minus";
export type ModelFilename = (typeof MODEL_FILENAMES)[number];
export type ModelArtifact = { name: ModelFilename; blob: Blob };
export type ModelSource = { artifacts: ModelArtifact[] };

export type SeparationConfiguration = {
  model: DemucsModel;
  twoStems: StemSource | null;
  method: TwoStemMethod;
  shifts: number;
};

export function isModelFilename(name: string): name is ModelFilename {
  return MODEL_FILENAMES.includes(name as ModelFilename);
}

export function modelAssetUrl(filename: ModelFilename): string {
  return `https://github.com/hi-ogawa/demucs-onnx/releases/download/${MODEL_RELEASE_TAG}/${filename}`;
}

export function requiredModelFiles({
  model,
  twoStems,
  method,
}: SeparationConfiguration): ModelFilename[] {
  if (model === "htdemucs") {
    return ["dft.bin", "htdemucs.onnx"];
  }
  if (twoStems && method === "minus") {
    return ["dft.bin", `htdemucs_ft_${twoStems}.onnx`];
  }
  return [
    "dft.bin",
    "htdemucs_ft_drums.onnx",
    "htdemucs_ft_bass.onnx",
    "htdemucs_ft_other.onnx",
    "htdemucs_ft_vocals.onnx",
  ];
}

export async function readModelFile(
  source: ModelSource,
  filename: ModelFilename,
): Promise<Uint8Array> {
  const artifact = source.artifacts.find(
    (candidate) => candidate.name === filename,
  );
  if (!artifact) {
    throw new Error(`Missing model file: ${filename}`);
  }
  return new Uint8Array(await artifact.blob.arrayBuffer());
}
