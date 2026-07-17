import { STORAGE_FRAME_ID } from "../storage-frame.ts";
import { setupRuntimeRelay } from "./runtime.ts";

function setupStorageFrame() {
  if (window !== window.top) {
    return;
  }

  const mount = () => {
    if (document.getElementById(STORAGE_FRAME_ID)) {
      return;
    }
    const iframe = document.createElement("iframe");
    iframe.id = STORAGE_FRAME_ID;
    iframe.hidden = true;
    iframe.src = chrome.runtime.getURL("src/storage.html");
    iframe.addEventListener("load", () => {
      iframe.dataset.storageReady = "true";
    });
    document.documentElement.append(iframe);
  };

  if (document.documentElement) {
    mount();
  } else {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  }
}

function main() {
  setupRuntimeRelay();
  setupStorageFrame();
}

main();
