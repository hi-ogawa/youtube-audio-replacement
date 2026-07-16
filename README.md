# Stem Mixer for YouTube

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

To develop the extension UI as a regular web app, run:

```sh
pnpm ui-preview
```

Then open `http://localhost:5173/src/ui/preview.html`.

## References

- [Extension architecture](docs/extension-architecture.html): execution contexts and acquisition RPC flow.
- [Chrome Web Store submission](docs/chrome-store-submission.md): listing details, privacy disclosures, test instructions, and release checklist.
- [Privacy policy](PRIVACY.md): local storage and network behavior.
- [yt-dlp-ext](https://github.com/hi-ogawa/yt-dlp-ext): source for the YouTube acquisition path.
- [demucs-onnx](https://github.com/hi-ogawa/demucs-onnx): source for Demucs inference, model management, progress reporting, and stem export.
