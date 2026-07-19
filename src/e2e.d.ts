import type { audioStorage } from "./lib/storage.ts";

declare global {
  interface Window {
    __e2e?: {
      audioStorage: typeof audioStorage;
    };
  }
}

export {};
