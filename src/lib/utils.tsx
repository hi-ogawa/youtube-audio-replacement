export function once<T>(fn: () => T): () => T {
  let result: { value: T } | undefined;
  return () => {
    result ??= { value: fn() };
    return result.value;
  };
}
