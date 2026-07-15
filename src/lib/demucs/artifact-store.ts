import type { ModelArtifact, ModelFilename } from "./models.ts";

type StoredModelArtifact = ModelArtifact & {
  size: number;
  importedAt: number;
};

const DATABASE_NAME = "youtube-audio-replacement-demucs-v1";
const STORE_NAME = "models";
let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME, { keyPath: "name" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return databasePromise;
}

export const modelArtifactManager = {
  async load(): Promise<StoredModelArtifact[]> {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async store(files: File[]): Promise<void> {
    const database = await openDatabase();
    const importedAt = Date.now();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      for (const file of files) {
        const artifact: StoredModelArtifact = {
          name: file.name as ModelFilename,
          blob: file,
          size: file.size,
          importedAt,
        };
        store.put(artifact);
      }
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
  },
};
