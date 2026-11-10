import { and, eq } from 'drizzle-orm';
import { sendNotification, setVapidDetails } from 'web-push';
import type { Language, PushSubscriptionJson } from '@app/shared';
import { config } from '../config.js';
import { db, schema } from '../db/index.js';

export interface PushMessage {
  title: string;
  body: string;
  /** Page to open when the notification is tapped. */
  url: string;
  tag?: string;
  lang?: Language;
}

type Sender = (sub: PushSubscriptionJson, payload: string) => Promise<unknown>;

/**
 * Push is on when both VAPID keys are set and valid. A bad push setting turns push off (and says
 * why in the logs) instead of stopping the whole app.
 */
function initVapid() {
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) return false;
  try {
    setVapidDetails(
      config.VAPID_SUBJECT || config.SITE_URL,
      config.VAPID_PUBLIC_KEY,
      config.VAPID_PRIVATE_KEY,
    );
    return true;
  } catch (err) {
    console.error('Push notifications disabled: invalid VAPID settings.', (err as Error).message);
    return false;
  }
}

export const pushEnabled = initVapid();

let sender: Sender = (sub, payload) =>
  sendNotification(sub, payload, { TTL: 24 * 3600, urgency: 'high' });

/** Tests swap in a fake sender. */
export function setPushSender(fn: Sender) {
  sender = fn;
}

export const publicVapidKey = () => (pushEnabled ? config.VAPID_PUBLIC_KEY! : null);

/** Save (or refresh) one of the admin's devices. */
export async function saveSubscription(adminId: string, sub: PushSubscriptionJson, lang: Language) {
  await db
    .insert(schema.pushSubscriptions)
    .values({ adminId, endpoint: sub.endpoint, keys: sub.keys, lang })
    .onConflictDoUpdate({
      target: [schema.pushSubscriptions.endpoint, schema.pushSubscriptions.adminId],
      set: { keys: sub.keys, lang },
    });
}

export async function removeAdminSubscription(adminId: string, endpoint: string) {
  await db
    .delete(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.adminId, adminId),
        eq(schema.pushSubscriptions.endpoint, endpoint),
      ),
    );
}

async function sendAll(
  rows: (typeof schema.pushSubscriptions.$inferSelect)[],
  message: (lang: Language) => PushMessage,
) {
  if (!pushEnabled) return 0;
  let sent = 0;
  await Promise.all(
    rows.map(async (row) => {
      const payload = JSON.stringify({ ...message(row.lang), lang: row.lang });
      try {
        await sender({ endpoint: row.endpoint, keys: row.keys }, payload);
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // The browser unsubscribed or the subscription expired: forget it.
          await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, row.id));
        } else {
          console.error('push failed', status ?? err);
        }
      }
    }),
  );
  return sent;
}

export async function pushToAdmins(message: (lang: Language) => PushMessage) {
  const rows = await db.select().from(schema.pushSubscriptions);
  return sendAll(rows, message);
}
