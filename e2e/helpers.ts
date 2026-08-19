/** Log elapsed checkpoints while investigating E2E timing. */
export function createCheckpoint(): (label: string) => void {
  const startedAt = performance.now();
  return (label) => {
    console.log(`[${Math.round(performance.now() - startedAt)}ms] ${label}`);
  };
}
