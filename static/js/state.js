/**
 * In-memory state management for Visual Cryptography runs.
 */

let lastRun = null;
const trackedUrls = new Set();

export function trackUrl(url) {
  if (url) {
    trackedUrls.add(url);
  }
  return url;
}

export function revokeAllUrls() {
  for (const url of trackedUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
  }
  trackedUrls.clear();
}

export function setLastRun(data) {
  lastRun = data;
}

export function getLastRun() {
  return lastRun;
}

export function clearRun() {
  revokeAllUrls();
  lastRun = null;
}
