# YouTube Audio Replacement

A Chrome extension that replaces a YouTube video's audio with a local audio file. YouTube remains the source of truth for play, pause, seeking, and playback rate.

## Features

- Drop or browse for a replacement audio file or stem ZIP. ZIP input selects its first audio entry.
- Remember the selected file for each video.
- Turn audio replacement on or off from the watch page.
- Follow YouTube playback, seeking, and playback-rate changes.
- Handle navigation between videos without reloading the page.

## Build and load

```sh
pnpm install
pnpm build
```

After building, `pnpm test-e2e` loads the extension in Chromium against a real YouTube watch page.

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this repository's `dist/extension` directory. The packaged extension is available at `dist/extension.zip`.

On a YouTube watch page, open the control in the bottom-right corner, choose a local audio file, and turn on **Audio replacement**. YouTube's existing controls and keyboard shortcuts continue to control playback.

## UI development

Run the standalone panel preview with:

```sh
pnpm dev-web
```

The preview uses a fake paused synchronization source so the extension UI can be styled without loading YouTube.
