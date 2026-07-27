import "../../src/ui/styles.css";
import { createElement, StrictMode, type ComponentType } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

type Story = ComponentType<Record<string, unknown>>;
type StoryModule = Record<string, Story>;
type MountParams = {
  story: string;
  props?: Record<string, unknown>;
};

const stories = import.meta.glob<StoryModule>("../../src/**/*.story.tsx");

function storyPath(path: string) {
  return path.replace(/^(\.\.\/)+src\//, "").replace(/\.story\.tsx$/, "");
}

async function resolveStory(storyId: string) {
  const separator = storyId.lastIndexOf("/");
  const path = storyId.slice(0, separator);
  const name = storyId.slice(separator + 1);
  const file = Object.keys(stories).find((candidate) => {
    const candidatePath = storyPath(candidate);
    return candidatePath === path || candidatePath.endsWith(`/${path}`);
  });
  const module = file ? await stories[file]?.() : undefined;
  return module?.[name] ?? module?.default;
}

const element = document.getElementById("root");
if (!element) {
  throw new Error("Story root not found");
}

let root: Root | undefined;

window.mount = async ({ story: storyId, props = {} }: MountParams) => {
  const story = await resolveStory(storyId);
  if (!story) {
    throw new Error(`Unknown story: ${storyId}`);
  }

  const currentRoot = (root ??= createRoot(element));
  flushSync(() => {
    currentRoot.render(
      createElement(StrictMode, null, createElement(story, props)),
    );
  });
};

window.unmount = async () => {
  root?.unmount();
  root = undefined;
};

declare global {
  interface Window {
    mount(params: MountParams): Promise<void>;
    unmount(): Promise<void>;
  }
}
