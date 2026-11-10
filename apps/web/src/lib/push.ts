import type { Language, PushSubscriptionJson } from '@app/shared';
import { apiFetch, apiSend } from './api';

/** Why push can't be used here (or 'ok'). */
export type PushSupport = 'ok' | 'unsupported' | 'install-first' | 'no-service-worker';

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export async function pushSupport(): Promise<PushSupport> {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  // iPhone/iPad only allow web push for apps added to the Home Screen.
  if (isIos() && !isStandalone()) return 'install-first';
  if (!('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? 'ok' : 'no-service-worker';
}

async function registration() {
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export class PushError extends Error {
  constructor(public readonly reason: 'denied' | 'server-off') {
    super(reason);
  }
}

/** Ask permission (if needed) and subscribe this device. */
export async function subscribeDevice(): Promise<PushSubscriptionJson> {
  const { publicKey } = await apiFetch<{ publicKey: string | null }>('/push/public-key');
  if (!publicKey) throw new PushError('server-off');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new PushError('denied');
  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  return sub.toJSON() as PushSubscriptionJson;
}

export async function enableAdminPush(lang: Language) {
  const subscription = await subscribeDevice();
  await apiSend<void>('POST', '/admin/push', { subscription, lang });
}

export async function disableAdminPush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await apiSend<void>('DELETE', '/admin/push', { endpoint: sub.endpoint });
  await sub.unsubscribe();
}

export async function enableGuestPush(token: string, lang: Language) {
  const subscription = await subscribeDevice();
  await apiSend<void>('POST', `/bookings/${token}/push`, { subscription, lang });
}

export const sendTestPush = () => apiSend<{ sent: number }>('POST', '/admin/push/test');
