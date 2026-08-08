import JSZip from "jszip";

interface AudioFile {
  name: string;
  blob: Blob;
}

export async function createAudioArchive(files: AudioFile[]): Promise<Blob> {
  const zip = new JSZip();
  const filenames = new Set<string>();

  for (const file of files) {
    const filename = deduplicateFilename(
      sanitizeFilename(file.name),
      filenames,
    );
    filenames.add(filename);
    zip.file(filename, file.blob, { compression: "STORE" });
  }

  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

export function toAudioArchiveFilename(title: string): string {
  return `${sanitizeFilename(title, "saved-audio")}.zip`;
}

export function toStemArchiveFilename(inputFilename: string): string {
  const basename = inputFilename.replaceAll(".", "_");
  return `${basename || "demucs"}.stems.zip`;
}

export function downloadBlob(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

function sanitizeFilename(filename: string, fallback = "audio"): string {
  const sanitized = filename
    .replaceAll(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replaceAll(/^\.+|[. ]+$/g, "")
    .trim();
  return sanitized || fallback;
}

function deduplicateFilename(filename: string, filenames: Set<string>): string {
  if (!filenames.has(filename)) {
    return filename;
  }

  const extensionIndex = filename.lastIndexOf(".");
  const basename =
    extensionIndex > 0 ? filename.slice(0, extensionIndex) : filename;
  const extension = extensionIndex > 0 ? filename.slice(extensionIndex) : "";
  let suffix = 2;
  while (filenames.has(`${basename} (${suffix})${extension}`)) {
    suffix += 1;
  }
  return `${basename} (${suffix})${extension}`;
}
