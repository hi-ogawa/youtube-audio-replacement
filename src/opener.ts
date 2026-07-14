type OpenRequest = {
  type: "audio-replacement-open-request";
  id: string;
  videoId: string;
};

window.addEventListener("message", async (event: MessageEvent<OpenRequest>) => {
  if (
    event.source !== window ||
    event.data?.type !== "audio-replacement-open-request"
  ) {
    return;
  }

  const { id, videoId } = event.data;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "audio-replacement-runtime-rpc",
      id,
      method: "openGenerator",
      params: { videoId },
    });
    window.postMessage(
      { type: "audio-replacement-open-response", id, ...response },
      "*",
    );
  } catch (error) {
    window.postMessage(
      {
        type: "audio-replacement-open-response",
        id,
        error: error instanceof Error ? error.message : String(error),
      },
      "*",
    );
  }
});
