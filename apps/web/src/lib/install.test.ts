import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dismissInstall,
  isInstallDismissed,
  isIos,
  promptInstall,
  useInstallState,
} from './install';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('isIos', () => {
  it.each([
    [
      'iPhone Safari',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
      5,
      true,
    ],
    [
      'iPad (desktop-class UA, touch)',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      5,
      true,
    ],
    [
      'Mac (no touch)',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      0,
      false,
    ],
    [
      'Android Chrome',
      'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141',
      5,
      false,
    ],
  ])('%s → %s', (_label, ua, touch, expected) => {
    expect(isIos(ua, touch)).toBe(expected);
  });
});

describe('"Not now"', () => {
  it('hides the prompt for 14 days', () => {
    const now = Date.UTC(2026, 10, 9);
    expect(isInstallDismissed(now)).toBe(false);
    dismissInstall(now);
    expect(isInstallDismissed(now + 13 * 86_400_000)).toBe(true);
    expect(isInstallDismissed(now + 15 * 86_400_000)).toBe(false);
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => dismissInstall()).not.toThrow();
    expect(isInstallDismissed()).toBe(false);
  });
});

describe('one-tap install (Chrome/Android)', () => {
  function fireInstallEvent(outcome: 'accepted' | 'dismissed') {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn(async () => undefined),
      userChoice: Promise.resolve({ outcome }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    return event;
  }

  it('offers the prompt, shows the browser dialog on tap, then hides', async () => {
    const { result } = renderHook(() => useInstallState());
    const event = fireInstallEvent('accepted');
    expect(event.defaultPrevented).toBe(true); // our button replaces the browser's mini-bar
    expect(result.current).toBe('prompt');

    let installed = false;
    await act(async () => {
      installed = await promptInstall();
    });
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(installed).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current).toBe('installed');
  });

  it('does nothing when the browser has not offered installation', async () => {
    expect(await promptInstall()).toBe(false);
  });
});
