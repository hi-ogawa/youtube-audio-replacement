# Privacy Policy for YouTube Audio Replacement

Last updated: July 16, 2026

YouTube Audio Replacement processes audio in your browser. The extension does not operate a project server, require an account, collect analytics, or sell or share user data.

## Information stored on your device

The extension stores the following information locally in your browser:

- Replacement audio files, their filenames, and the associated YouTube video IDs.
- Whether the audio replacement panel is open for a video.
- Demucs configuration preferences, such as the selected model and stem settings.
- Demucs model files that you choose to import.

This information remains on your device and is not sent to the extension developer. You can remove it by clearing site data for YouTube and extension storage, or by uninstalling the extension.

## Information sent to other services

When you choose to load audio from a public YouTube video, the extension:

- Sends the video ID and YouTube visitor identifier already available on the page to YouTube's player API to request video metadata and available audio formats.
- Downloads the selected audio stream from a Googlevideo domain supplied by YouTube.

The extension provides links to model files hosted in the `hi-ogawa/demucs-onnx` GitHub releases. A model is downloaded only when you follow one of those links. Local audio files and model files that you choose from your device are processed locally and are not uploaded by the extension.

These services process requests according to their own privacy policies. The extension does not transmit information to an analytics provider or to a server operated by the extension developer.

## Permissions

The extension runs on YouTube so it can add the audio replacement controls and synchronize replacement audio with the YouTube player. It accesses Googlevideo only to download a YouTube audio stream that you explicitly request. Access to the active tab is used when you click the extension icon so the stem generator can be prefilled with the current YouTube video.

## Contact

For privacy questions, open an issue at https://github.com/hi-ogawa/youtube-audio-replacement/issues.
