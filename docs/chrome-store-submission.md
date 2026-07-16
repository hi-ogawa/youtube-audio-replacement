# Chrome Web Store Submission

Canonical listing details and release checklist for Stem Mixer for YouTube. Review this document against the current code before every submission.

## Listing

### Name

```text
Stem Mixer for YouTube
```

### Version

Enter the release version when dispatching the **release extension** workflow. Use `0.0.1` for the initial submission. The workflow applies it to the packaged manifest without changing `public/manifest.json` in the repository.

### Summary

132-character limit:

```text
Replace YouTube audio with a synchronized local track, or separate YouTube and local audio into Demucs stems.
```

### Description

```text
Stem Mixer for YouTube lets you listen to a YouTube video with a synchronized replacement audio track. You can choose an existing local audio file or prepare new audio with the built-in stem generator.

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

### Distribution

- Visibility: Public
- Regions: All regions
- Pricing: Free
- Mature content: No
- Initial rollout: 100% after approval

🙋 Confirm that the developer contact email shown in the dashboard is current and verified. This account-level value is not stored in the repository.

### URLs

- Support URL: `https://github.com/hi-ogawa/youtube-audio-replacement/issues`
- Privacy policy URL: `https://github.com/hi-ogawa/youtube-audio-replacement/blob/main/PRIVACY.md`

The privacy URL will work after `PRIVACY.md` is merged into the default branch.

## Store assets

Use screenshots at 1280x800 with 1x pixel density. Avoid personal account information, copyrighted artwork that is not needed to demonstrate the feature, and development-only browser UI.

🙋 Capture and upload the screenshots. They cannot be prepared from repository data alone because they require choosing suitable YouTube content and checking the captured account information.

Capture these scenes:

1. A YouTube watch page with the Stem mixer panel open and a replacement file selected.
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

### Dashboard data categories

Use the same disclosure interpretation as Zamak (`ytsub-v5`): requests sent back to YouTube to provide the user-requested feature, and data processed only in local browser storage, are described in the privacy policy but are not declared as data collected by the extension developer.

- Personally identifiable information: No. The extension does not collect identity information. It returns the YouTube visitor identifier already present on the page only to YouTube's player API.
- Health information: No.
- Financial and payment information: No.
- Authentication information: No. The extension does not read passwords, credentials, or authentication tokens.
- Personal communications: No.
- Location: No.
- Web history: No. The extension does not collect or transmit browsing history. It uses the active YouTube video ID locally to provide the requested feature.
- User activity: No. The extension does not monitor clicks, keystrokes, scrolling, or browsing behavior for analytics or profiling.
- Website content: No. YouTube video metadata and the selected audio stream are processed only to provide the requested feature and are not collected by the extension developer.

### Data-use certifications

Select all applicable certification checkboxes:

- Data is not sold to third parties.
- Data is not used or transferred for purposes unrelated to the extension's single purpose.
- Data is not used or transferred to determine creditworthiness or for lending purposes.
- Data is not used for personalized advertising, analytics, or profiling.

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

- [x] Confirm the manifest description and store summary are current.
- [x] Confirm permissions are minimal and all justifications are current.
- [x] Confirm `PRIVACY.md` matches actual storage and network behavior.
- [ ] 🙋 Confirm the dashboard developer contact email.
- [x] Set the dashboard data categories using the established Zamak interpretation.
- [ ] Confirm the support and privacy URLs are publicly accessible.
- [ ] 🙋 Capture and upload the current 1280x800 screenshots.
- [ ] 🙋 Dispatch **release extension** with a new version and download `extension.zip`.
- [ ] Confirm the release workflow's checks, build, and package verification pass.
- [ ] 🙋 Smoke-test the downloaded package in Chrome.
- [ ] 🙋 Upload the downloaded `extension.zip` and complete the privacy form.
- [ ] 🙋 Submit for review.
- [ ] 🙋 Verify the approved listing and installation flow.
