import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function patchCiManifest() {
  return {
    name: "patch-ci-manifest",
    closeBundle() {
      if (!process.env.CI) {
        return;
      }

      const revision = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
        encoding: "utf8",
      }).trim();
      const prMatch = process.env.GITHUB_REF?.match(/refs\/pull\/(\d+)\//);
      const manifestPath = "dist/extension/manifest.json";
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.name = prMatch
        ? `YouTube Audio Replacement [PR#${prMatch[1]} ${revision}]`
        : `YouTube Audio Replacement [${revision}]`;
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), patchCiManifest()],
  build: {
    outDir: "dist/extension",
    minify: false,
    rolldownOptions: {
      input: {
        content: "./src/content.tsx",
      },
      output: {
        format: "iife",
        entryFileNames: "[name].js",
      },
    },
  },
});
