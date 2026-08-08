import JSZip from "jszip";

interface AudioFile {
  name: string;
  blob: Blob;
}

export async function createAudioArchive(files: AudioFile[]): Promise<Blob> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(sanitizeFilename(file.name), file.blob, { compression: "STORE" });
  }

  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

export function downloadBlob(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

export function sanitizeFilename(filename: string, fallback = "audio"): string {
  const sanitized = filename
    .replaceAll(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replaceAll(/^\.+|[. ]+$/g, "")
    .trim();
  return sanitized || fallback;
}
