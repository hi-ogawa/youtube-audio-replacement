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
  environments: {
    generator: {
      consumer: "client",
      build: {
        outDir: "dist/extension",
        minify: false,
        rolldownOptions: {
          input: {
            generator: "./generator.html",
          },
        },
      },
    },
    content: scriptBuild("content", "./src/content.tsx"),
    acquisition: scriptBuild("acquisition", "./src/acquisition.ts"),
    relay: scriptBuild("relay", "./src/relay.ts"),
    opener: scriptBuild("opener", "./src/opener.ts"),
    background: scriptBuild("background", "./src/background.ts"),
  },
  builder: {
    async buildApp(builder) {
      await builder.build(builder.environments.generator);
      await builder.build(builder.environments.content);
      await builder.build(builder.environments.acquisition);
      await builder.build(builder.environments.relay);
      await builder.build(builder.environments.opener);
      await builder.build(builder.environments.background);
    },
  },
});

function scriptBuild(name: string, input: string) {
  return {
    consumer: "client" as const,
    build: {
      outDir: "dist/extension",
      minify: false,
      emptyOutDir: false,
      copyPublicDir: false,
      rolldownOptions: {
        input: {
          [name]: input,
        },
        output: {
          format: "iife" as const,
          entryFileNames: "[name].js",
        },
      },
    },
  };
}
