# YouTube Audio Replacement

A Chrome extension for preparing and playing replacement audio on YouTube. It can generate Demucs stems from a public YouTube video or local audio file entirely in the browser, then synchronize the selected replacement track with YouTube playback, seeking, and playback rate.

## Features

- Generate stems from a public YouTube video or local audio file.
- Run two-stem or four-stem Demucs separation in a browser worker.
- Preview and download individual WAV stems or an ordered stem ZIP.
- Turn audio replacement on from the watch page.

## Model files

The stem generator page links to the required model files from the [demucs-onnx releases](https://github.com/hi-ogawa/demucs-onnx/releases). Model files are not bundled with this extension.

## Development

```sh
pnpm install
pnpm build
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this repository's `dist/extension` directory. The packaged extension is available at `dist/extension.zip`.

## Development

See [the extension architecture](docs/extension-architecture.html) for the execution contexts and acquisition RPC flow.

The YouTube acquisition path is adapted from [yt-dlp-ext](https://github.com/hi-ogawa/yt-dlp-ext). Demucs inference, model management, progress reporting, and stem export are adapted from [demucs-onnx](https://github.com/hi-ogawa/demucs-onnx).
