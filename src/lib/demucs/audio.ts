import JSZip from "jszip";

const AUDIO_SAMPLE_RATE = 44_100;

export interface DecodedAudio {
  name: string;
  left: Float32Array;
  right: Float32Array;
}

export async function decodeAudioFile(file: File): Promise<DecodedAudio> {
  const context = new OfflineAudioContext({
    numberOfChannels: 2,
    length: 1,
    sampleRate: AUDIO_SAMPLE_RATE,
  });
  const buffer = await context.decodeAudioData(await file.arrayBuffer());
  // Copy out of AudioBuffer storage so each channel can be transferred to the worker.
  const left = buffer.getChannelData(0).slice();
  const right =
    buffer.numberOfChannels > 1
      ? buffer.getChannelData(1).slice()
      : left.slice();
  return { name: file.name, left, right };
}

export function encodeWavF32(channels: Float32Array[]): Blob {
  const channelCount = channels.length;
  const frames = channels[0]?.length ?? 0;
  const dataBytes = frames * channelCount * 4;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, AUDIO_SAMPLE_RATE, true);
  view.setUint32(28, AUDIO_SAMPLE_RATE * channelCount * 4, true);
  view.setUint16(32, channelCount * 4, true);
  view.setUint16(34, 32, true);
  writeAscii(36, "data");
  view.setUint32(40, dataBytes, true);
  const output = new Float32Array(buffer, 44);
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      output[frame * channelCount + channel] = channels[channel][frame];
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function toStemArchiveFilename(inputFilename: string): string {
  return `${inputFilename.replaceAll(".", "_") || "demucs"}.stems.zip`;
}

export async function createStemArchive(
  stems: { name: string; blob: Blob }[],
): Promise<Blob> {
  const zip = new JSZip();
  for (const stem of stems) {
    zip.file(`${stem.name}.wav`, stem.blob, { compression: "STORE" });
  }
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

export function downloadBlob(url: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}
