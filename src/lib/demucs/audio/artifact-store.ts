import { IdbStore } from "../../idb.ts";
import type { ModelArtifact, ModelFilename } from "./models.ts";

type StoredModelArtifact = ModelArtifact & {
  size: number;
  importedAt: number;
};

const artifactStore = new IdbStore<StoredModelArtifact>({
  databaseName: "youtube-audio-replacement-demucs-v1",
  storeName: "models",
  version: 1,
  keyPath: "name",
});

export const modelArtifactManager = {
  load: () => artifactStore.getAll(),
  store: (files: File[]) => {
    const importedAt = Date.now();
    const artifacts: StoredModelArtifact[] = files.map((file) => ({
      name: file.name as ModelFilename,
      blob: file,
      size: file.size,
      importedAt,
    }));
    return artifactStore.putAll(artifacts);
  },
};
