// Adapted from https://github.com/hi-ogawa/yt-dlp-ext/blob/main/src/lib/rpc.ts
export function once<T>(fn: () => T): () => T {
  let result: { value: T } | undefined;
  return () => {
    result ??= { value: fn() };
    return result.value;
  };
}

export function formatBytes(bytes: number) {
  if (!bytes) {
    return "0 MB";
  }
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
