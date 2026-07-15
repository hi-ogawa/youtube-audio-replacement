import type { ProgressEvent } from "./separate.ts";

export type RunProgress = {
  phase: "preparing" | "loading" | "separating" | "finalizing" | "complete";
  startedAt: number;
  completedAt?: number;
  done: number;
  total: number;
  currentModel?: {
    file: string;
    done: number;
    total: number;
    index: number;
    modelTotal: number;
  };
};

export function initialRunProgress(): RunProgress {
  return {
    phase: "preparing",
    startedAt: Date.now(),
    done: 0,
    total: 0,
  };
}

export function updateRunProgress(
  progress: RunProgress,
  event: ProgressEvent,
  at: number,
): RunProgress {
  switch (event.type) {
    case "started":
      return { ...progress, total: event.total };
    case "model-loading":
      return {
        ...progress,
        phase: "loading",
        currentModel: {
          file: event.file,
          done: 0,
          total: event.chunks,
          index: event.index,
          modelTotal: event.total,
        },
      };
    case "model-loaded":
      return { ...progress, phase: "separating" };
    case "inference":
      return {
        ...progress,
        phase: "separating",
        done: event.done,
        total: event.total,
        currentModel: progress.currentModel
          ? {
              ...progress.currentModel,
              done: event.memberDone,
              total: event.memberTotal,
            }
          : undefined,
      };
    case "model-complete":
      return progress.currentModel
        ? {
            ...progress,
            currentModel: {
              ...progress.currentModel,
              done: progress.currentModel.total,
            },
          }
        : progress;
    case "finalizing":
      return { ...progress, phase: "finalizing" };
    case "finalized":
      return { ...progress, phase: "complete", completedAt: at };
  }
}
