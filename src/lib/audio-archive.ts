import JSZip from "jszip";
import type { StoredAudioTrack } from "./storage.ts";

export async function createAudioArchive(
  tracks: StoredAudioTrack[],
): Promise<Blob> {
  const zip = new JSZip();
  const filenames = new Set<string>();

  for (const track of tracks) {
    const filename = deduplicateFilename(
      sanitizeFilename(track.name),
      filenames,
    );
    filenames.add(filename);
    zip.file(filename, track.blob, { compression: "STORE" });
  }

  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

export function toAudioArchiveFilename(title: string): string {
  return `${sanitizeFilename(title, "saved-audio")}.zip`;
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
