import { ExtensionPagePreview } from "./extension-page-preview.tsx";

export const Generator = () => <ExtensionPagePreview />;

export const SavedVideos = () => <ExtensionPagePreview initialView="saved" />;

export const EmptySavedVideos = () => (
  <ExtensionPagePreview initialView="saved" emptySavedVideos />
);
