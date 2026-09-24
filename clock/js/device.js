// Screen wake lock and full-screen, feature-detected for Safari on iPad.

export const isStandalone = () =>
  navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

let lock = null;

/**
 * Ask the browser to keep the screen on. Works in Safari tabs on iPadOS 16.4+.
 * Home Screen web apps ignore it before iPadOS 18.4, so there Auto-Lock → Never is the fix.
 */
export async function keepAwake() {
  if (lock || !navigator.wakeLock || document.visibilityState !== 'visible') return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => {
      lock = null;
    });
  } catch {
    lock = null;
  }
}

const root = document.documentElement;

export const canFullscreen = () =>
  !isStandalone() && Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);

const isFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);

export function toggleFullscreen() {
  try {
    const result = isFullscreen()
      ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
      : (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    if (result && result.catch) result.catch(() => {});
  } catch {
    // Not allowed here; the button simply does nothing.
  }
}
