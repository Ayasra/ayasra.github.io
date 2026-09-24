// Screen wake lock and full-screen, feature-detected for Safari on iPad.

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

/**
 * Full screen is the only way a web page can hide the iPad's status bar (time, battery):
 * Home Screen web apps always show it. Safari allows full screen in a tab; where the Home
 * Screen app allows it too, this reports true there as well.
 */
export const canFullscreen = () => Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);

export const isFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);

/** Enter or leave full screen. Entering only works from a tap. */
export function setFullscreen(on) {
  if (on === isFullscreen()) return;
  try {
    const result = on
      ? (root.requestFullscreen || root.webkitRequestFullscreen).call(root)
      : (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    if (result && result.catch) result.catch(() => {});
  } catch {
    // Not allowed here; nothing changes.
  }
}

export function onFullscreenChange(handler) {
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
}
