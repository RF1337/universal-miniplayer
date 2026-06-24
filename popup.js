const btn = document.getElementById("pipBtn");

btn.addEventListener("click", async () => {
  btn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // consumerTabId must be set explicitly: without it, the stream ID is only
    // valid in the same origin/process as this popup, not inside the page
    // we're about to inject into.
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id,
      consumerTabId: tab.id
    });

    // requestPictureInPicture() requires an active user gesture. That only
    // exists here, in the popup's click handler, and chrome.scripting.executeScript
    // carries it into the injected script if called as part of the same gesture.
    // (An offscreen document can never satisfy this requirement.)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: startPictureInPicture,
      args: [streamId]
    });

    window.close();
  } catch (err) {
    console.error("Capture failed:", err);
    btn.disabled = false;
  }
});

async function startPictureInPicture(streamId) {
  const video = document.createElement("video");
  video.style.position = "fixed";
  video.style.top = "-9999px";
  video.style.width = "1px";
  video.style.height = "1px";
  document.documentElement.appendChild(video);

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    },
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    }
  });

  const cleanup = () => {
    stream.getTracks().forEach((track) => track.stop());
    video.remove();
  };

  video.srcObject = stream;
  await video.play();
  await video.requestPictureInPicture();

  video.addEventListener("leavepictureinpicture", cleanup, { once: true });
  stream.getVideoTracks()[0].addEventListener("ended", cleanup, { once: true });
}
