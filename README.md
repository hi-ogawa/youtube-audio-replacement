# YouTube Audio Replacement

A Chrome extension for preparing and playing replacement audio on YouTube. It can generate Demucs stems from a public YouTube video or local audio file entirely in the browser, then synchronize the selected replacement track with YouTube playback, seeking, and playback rate.

## Features

- Generate stems from a public YouTube video or local audio file.
- Run two-stem or four-stem Demucs separation in a browser worker.
- Default to the fast fine-tuned bass-practice configuration.
- Preview and download individual WAV stems or an ordered stem ZIP.
- Drop or browse for a replacement audio file or stem ZIP. ZIP input selects its first audio entry.
- Remember the selected replacement file for each video.
- Turn audio replacement on or off from the watch page.
- Follow YouTube playback, seeking, and playback-rate changes.
- Handle navigation between videos without reloading the page.

## Workflow

```text
YouTube watch page
-> Prepare stems
-> acquire YouTube audio or select a local file
-> add the required Demucs models
-> separate and download the ordered stem ZIP
-> upload the ZIP into the replacement controls
```

The default configuration creates `backing.wav` and `bass.wav`. `backing.wav` is first in the ZIP, so the replacement controls select it automatically.

The toolbar action also opens the stem generator. The generator can be used independently with a local file.

## Build and load

```sh
pnpm install
pnpm build
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this repository's `dist/extension` directory. The packaged extension is available at `dist/extension.zip`.

On a YouTube watch page, open the control in the bottom-right corner to prepare stems or choose replacement audio. YouTube's existing controls and keyboard shortcuts continue to control playback.

## Model files

The generator links to the required model files from the [demucs-onnx releases](https://github.com/hi-ogawa/demucs-onnx/releases). Model files are not bundled with this extension.

Selected models are stored in IndexedDB under the browser's normal storage quota, so they remain available after reloading the generator. Generated stems are held in memory for preview and download; they are not persisted in extension storage.

## YouTube acquisition

YouTube acquisition uses a credentialless hidden YouTube iframe and therefore behaves as an anonymous session. It is intended for ordinary public videos. Private, paid, members-only, and other account-gated videos may not work.

The generator does not embed a visible player and does not provide trimming or partial downloads. The standalone [yt-dlp-ext](https://github.com/hi-ogawa/yt-dlp-ext) remains the broader download and trimming tool.

## Development

```sh
pnpm lint-check
pnpm test-ui
pnpm test-e2e
pnpm ui-preview
```

The UI preview includes the replacement panel and stem-generator mockup without requiring a loaded extension.

See [the extension architecture](docs/extension-architecture.html) for the execution contexts and acquisition RPC flow.

The YouTube acquisition path is adapted from [yt-dlp-ext](https://github.com/hi-ogawa/yt-dlp-ext). Demucs inference, model management, progress reporting, and stem export are adapted from [demucs-onnx](https://github.com/hi-ogawa/demucs-onnx).
