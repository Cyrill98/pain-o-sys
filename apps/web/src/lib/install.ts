import { useSyncExternalStore } from 'react';

/**
 * "Install as app" support.
 * - Chrome/Edge/Samsung Internet (Android, desktop) fire `beforeinstallprompt`; we keep that
 *   event and call `prompt()` when the person taps our Install button.
 * - iPhone/iPad have no install API: we show the Share → "Add to Home Screen" steps instead.
 * The listener is registered when this module is imported (from main.tsx), before React
 * renders, because the browser may fire the event very early.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'prompt' | 'ios' | 'none';

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own button instead of the browser's mini-bar
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

export function isIos(ua = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints) {
  // iPadOS reports itself as a Mac; touch support gives it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

/** Already running as the installed app? */
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function snapshot(): string {
  if (installedNow || isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIos()) return 'ios';
  return 'none';
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Show the browser's install dialog. Resolves true if the person installed. */
export async function promptInstall() {
  const event = deferred;
  if (!event) return false;
  deferred = null; // a prompt event can only be used once
  emit();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === 'accepted';
}

/** 'installed' | 'prompt' (one-tap install) | 'ios' (show steps) | 'none' (not available). */
export function useInstallState() {
  return useSyncExternalStore(subscribe, snapshot, () => 'none') as 'installed' | InstallPlatform;
}

// ── "Not now" memory ─────────────────────────────────
const DISMISS_KEY = 'install-dismissed-at';
const DISMISS_DAYS = 14;

export function isInstallDismissed(now = Date.now()) {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && now - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function dismissInstall(now = Date.now()) {
  try {
    localStorage.setItem(DISMISS_KEY, String(now));
  } catch {
    // Not critical: the banner just shows again next time.
  }
}
