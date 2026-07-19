import JSZip from "jszip";

const AUDIO_MIME_TYPES: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
  webm: "audio/webm",
};

export interface ResolvedAudioTrack {
  name: string;
  file: File;
}

export interface ResolvedAudioSet {
  name: string;
  tracks: ResolvedAudioTrack[];
}

export async function resolveAudioFiles(file: File): Promise<ResolvedAudioSet> {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return {
      name: file.name,
      tracks: [{ name: file.name, file }],
    };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("Could not read ZIP file.");
  }

  const tracks: ResolvedAudioTrack[] = [];
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) {
      continue;
    }
    const name = entry.name.split("/").at(-1) ?? "";
    const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
    const type = AUDIO_MIME_TYPES[extension];
    if (name && type) {
      tracks.push({
        name: entry.name,
        file: new File([await entry.async("blob")], name, { type }),
      });
    }
  }
  if (tracks.length === 0) {
    throw new Error("ZIP does not contain a supported audio file.");
  }
  return { name: file.name, tracks };
}

export function formatTrackName(name: string): string {
  const basename = name.split("/").at(-1) ?? name;
  const extensionIndex = basename.lastIndexOf(".");
  const displayName =
    extensionIndex > 0 ? basename.slice(0, extensionIndex) : basename;
  return displayName
    ? displayName[0].toUpperCase() + displayName.slice(1)
    : basename;
}
