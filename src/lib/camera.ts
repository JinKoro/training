/**
 * One camera stream for the whole app session. iOS (especially the home-screen app) asks for camera access on
 * every new getUserMedia call, so the scanner reuses a live stream instead of stopping it: after a scan the
 * camera is only paused, and released after 3 minutes unused or when the app goes to the background.
 */
let stream: MediaStream | null = null;
let idleTimer = 0;

const live = (s: MediaStream | null): s is MediaStream => !!s && s.getVideoTracks().some((t) => t.readyState === 'live');

function release() {
  clearTimeout(idleTimer);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

export async function getCamera(constraints: MediaStreamConstraints): Promise<MediaStream> {
  clearTimeout(idleTimer);
  if (live(stream)) {
    stream.getTracks().forEach((t) => { t.enabled = true; });
    return stream;
  }
  stream = await navigator.mediaDevices.getUserMedia(constraints);
  return stream;
}

/** The scanner closed: pause the camera, keep it for the next scan for a while. */
export function parkCamera() {
  if (!live(stream)) { stream = null; return; }
  stream.getTracks().forEach((t) => { t.enabled = false; });
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(release, 3 * 60_000);
}

document.addEventListener('visibilitychange', () => { if (document.hidden && stream && stream.getTracks().every((t) => !t.enabled)) release(); });
