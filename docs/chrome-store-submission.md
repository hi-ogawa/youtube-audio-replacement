# Chrome Web Store Submission

Canonical listing details and release checklist for YouTube Audio Replacement. Review this document against the current code before every submission.

## Release workflow

1. Review user-visible changes since the previous store submission.
2. Confirm that the listing, privacy disclosures, permission justifications, and test instructions below remain accurate.
3. Increment `version` in `public/manifest.json`. Chrome Web Store versions cannot be reused.
4. Run the checks and build locally with `CI` unset:

   ```sh
   pnpm lint-check
   pnpm test-ui
   pnpm test-e2e
   pnpm build
   ```

5. Inspect `dist/extension/manifest.json` and `dist/extension.zip`. The extension name must not contain a CI revision suffix.
6. Load `dist/extension` through `chrome://extensions` and complete the manual tests below.
7. Upload `dist/extension.zip` to the Chrome Web Store Developer Dashboard.
8. Recheck all dashboard fields, submit for review, and verify the approved listing and installation flow.

CI artifacts are intended for development testing. CI adds a revision suffix to the extension name, so they are not canonical store packages.

## Listing

### Name

```text
YouTube Audio Replacement
```

### Version

Read the release version from `public/manifest.json`. The initial candidate is `0.0.1`.

### Summary

132-character limit:

```text
Replace YouTube audio with a synchronized local track, or separate YouTube and local audio into Demucs stems.
```

### Description

```text
YouTube Audio Replacement lets you listen to a YouTube video with a synchronized replacement audio track. You can choose an existing local audio file or prepare new audio with the built-in stem generator.

Features:
- Replace a YouTube video's audio with a local audio file.
- Keep replacement playback synchronized with play, pause, seek, playback rate, and volume changes.
- Generate two-stem or four-stem Demucs separations from a public YouTube video or local audio file.
- Preview and download individual WAV stems or an ordered ZIP archive.
- Keep replacement audio, imported models, and preferences on your device.
- Run audio separation locally in the browser with WebAssembly.

How it works:
Open a YouTube watch page and use the floating audio replacement control to choose a local track or open the stem generator. The generator accepts a public YouTube URL or a local audio file. After you provide the required Demucs model files, processing runs in your browser.

No account is required. The extension has no analytics or cloud synchronization.

The project is open source: https://github.com/hi-ogawa/youtube-audio-replacement
```

### Category and language

- Category: Productivity
- Language: English

### URLs

- Support URL: `https://github.com/hi-ogawa/youtube-audio-replacement/issues`
- Privacy policy URL: `https://github.com/hi-ogawa/youtube-audio-replacement/blob/main/PRIVACY.md`

The privacy URL will work after `PRIVACY.md` is merged into the default branch.

## Store assets

Use screenshots at 1280x800 with 1x pixel density. Avoid personal account information, copyrighted artwork that is not needed to demonstrate the feature, and development-only browser UI.

Capture these scenes:

1. A YouTube watch page with the audio replacement panel open and a replacement file selected.
2. The stem generator with a YouTube source loaded and the separation settings visible.
3. Completed stem generation with individual preview/download controls and the ZIP download.

Use `public/icons/icon-128.png` as the store icon. Promotional images are optional for the initial submission.

## Privacy practices

### Single purpose

```text
Prepare replacement audio and play it in synchronization with a YouTube video.
```

### `activeTab` justification

```text
When the user clicks the extension toolbar icon, the extension reads the active tab URL only to identify the current YouTube video and prefill that video in the stem generator. The permission is activated only by the user's toolbar click.
```

### `https://www.youtube.com/*` justification

```text
The extension adds audio replacement controls to YouTube watch pages and synchronizes a user-selected local audio track with the YouTube player. When the user asks to prepare audio from a public YouTube video, it also requests that video's metadata and available audio formats from YouTube's player API. The extension does not run on unrelated sites.
```

### `https://*.googlevideo.com/*` justification

```text
When the user explicitly loads a public YouTube video in the stem generator, YouTube supplies an audio-stream URL on a Googlevideo domain. The background service worker downloads that selected stream so it can be separated locally in the browser. Access is restricted to HTTPS Googlevideo hosts.
```

### Remote code

```text
No remote code is used. All JavaScript and WebAssembly executable code is bundled in the extension package. The extension page permits wasm-unsafe-eval so its bundled WebAssembly audio processing runtime can run. Demucs model files are user-selected model weights/data, not executable code. Links to model data are hosted in the hi-ogawa/demucs-onnx GitHub releases.
```

### Data use

The corresponding dashboard disclosures must remain consistent with `PRIVACY.md`:

- Replacement audio files, filenames, video IDs, panel state, Demucs preferences, and imported model files are stored locally.
- Loading a public YouTube source sends its video ID and the YouTube visitor identifier already present on the page to YouTube's player API.
- The selected YouTube audio stream is downloaded from a Googlevideo URL supplied by YouTube.
- Local audio and imported model files are not uploaded.
- There is no developer-operated server, account system, analytics, advertising, sale of data, or cloud synchronization.

## Reviewer instructions

No account, credentials, or special test environment is required.

### Test local audio replacement

1. Install the extension and open a YouTube watch page.
2. Click the floating audio control near the lower-right corner.
3. Select any local audio file.
4. Enable replacement and confirm that the original video is muted while the selected audio follows play, pause, seek, and playback-rate changes.

### Test the stem generator

1. Click the extension toolbar icon. When invoked from a YouTube video, the current video ID should be prefilled.
2. Load a public YouTube URL or choose a local audio file.
3. Follow the model-file links shown by the generator and import the required files.
4. Run a separation and confirm that individual WAV outputs can be previewed/downloaded and that the ZIP can be downloaded.

Model files are not bundled because of their size. Local audio replacement is available without them.

## Submission checklist

- [ ] Choose and set the release version in `public/manifest.json`.
- [ ] Confirm the manifest description and store summary are current.
- [ ] Confirm permissions are minimal and all justifications are current.
- [ ] Confirm `PRIVACY.md` matches actual storage and network behavior.
- [ ] Confirm the support and privacy URLs are publicly accessible.
- [ ] Capture current 1280x800 screenshots.
- [ ] Run lint, UI tests, and end-to-end tests.
- [ ] Build locally with `CI` unset.
- [ ] Inspect the packaged manifest and ZIP contents.
- [ ] Smoke-test the exact unpacked release package.
- [ ] Upload `dist/extension.zip` and complete the privacy form.
- [ ] Submit for review.
- [ ] Verify the approved listing and installation flow.
