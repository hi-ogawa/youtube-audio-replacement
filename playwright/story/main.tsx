import "../../src/ui/styles.css";
import { createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";

type Story = ComponentType<Record<string, unknown>>;
type StoryModule = Record<string, Story>;
type MountParams = {
  story: string;
  props?: Record<string, unknown>;
};

const modules = import.meta.glob<StoryModule>("../../src/**/*.story.tsx", {
  eager: true,
});
const stories = new Map<string, Story>();

for (const [path, module] of Object.entries(modules)) {
  const file = path
    .replace(/^\.\.\/\.\.\/src\//, "")
    .replace(/\.story\.tsx$/, "");
  for (const [name, story] of Object.entries(module)) {
    stories.set(`${file}/${name}`, story);
  }
}

const element = document.getElementById("root");
if (!element) {
  throw new Error("Story root not found");
}

let root: Root | undefined;

window.mount = async ({ story: storyId, props = {} }: MountParams) => {
  const story = stories.get(storyId);
  if (!story) {
    throw new Error(`Unknown story: ${storyId}`);
  }

  root ??= createRoot(element);
  root.render(createElement(story, props));
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
