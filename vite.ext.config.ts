// Adapted from https://github.com/hi-ogawa/yt-dlp-ext/blob/main/vite.ext.config.ts
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Generated with `pnpm generate-extension-key`.
// CI extension ID: gkkibdaednnfaiegidnaafjagffcoafh.
// Changing this key changes the ID and disconnects existing extension-origin storage.
const CI_EXTENSION_PUBLIC_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApf9N5qRz9dh1sE4EIb/8a8GlfJBZsxPa/SCaSLGST4Eg3se/0y/l9jWuHmKTHfLs9g0XWxh8uUQgh/OwsbzBZvwzzuv8GuTWZEbRfiFHpSDZm0ktpks1aS12OJps08W7X3yWvlrmNC+KNhjZjnzrqPFyavp3KL1HFD2rcHSE9tM4bCaPyoxbFDkvknS/kapBRQDFYT68c0bgEX1B6Uyrv8tSLYNRsWTBz4hk6TK8/y+V2sOqO3dr9zf1eZZdFiKHYzLb/QoWCoPWqBk5+rKZiVxckLyoNC1gKc5AgrosUeNDchkIy3SGjCT1E4G2AIgKoL4TLxwb4qICPXTh05mQPQIDAQAB";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "onnxruntime-web/wasm": resolve(
        import.meta.dirname,
        "node_modules/onnxruntime-web/dist/ort.wasm.min.mjs",
      ),
    },
  },
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
  },
  environments: {
    extensionPage: {
      consumer: "client",
      build: {
        outDir: "dist/extension",
        minify: false,
        rolldownOptions: {
          input: {
            "extension-page": "./index.html",
          },
        },
      },
    },
    extensionStorage: {
      consumer: "client",
      build: {
        outDir: "dist/extension",
        emptyOutDir: false,
        copyPublicDir: false,
        rolldownOptions: {
          input: {
            "extension-storage": "./src/extension-storage.html",
          },
          output: {
            codeSplitting: false,
            entryFileNames: "extension-storage.js",
          },
        },
      },
    },
    content: scriptBuild("content", "./src/content.tsx"),
    rpcRelay: scriptBuild("rpc-relay", "./src/lib/rpc/entry.relay.ts"),
    embedContent: scriptBuild("embed-content", "./src/embed-content.ts"),
    background: scriptBuild("background", "./src/background.ts"),
  },
  builder: {
    async buildApp(builder) {
      await builder.build(builder.environments.extensionPage);
      await builder.build(builder.environments.extensionStorage);
      await builder.build(builder.environments.content);
      await builder.build(builder.environments.rpcRelay);
      await builder.build(builder.environments.embedContent);
      await builder.build(builder.environments.background);

      if (process.env.PATCH_MANIFEST === "true") {
        const revision = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
          encoding: "utf8",
        }).trim();
        const prMatch = process.env.GITHUB_REF?.match(/refs\/pull\/(\d+)\//);
        const manifestPath = "dist/extension/manifest.json";
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        manifest.key = CI_EXTENSION_PUBLIC_KEY;
        manifest.name = prMatch
          ? `Stem Mixer for YouTube [PR#${prMatch[1]} ${revision}]`
          : `Stem Mixer for YouTube [${revision}]`;
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      }
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
