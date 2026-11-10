import { config } from '../config.js';

export interface Email {
  subject: string;
  text: string;
}

type Mailer = (email: Email) => Promise<void>;

export const emailEnabled = Boolean(
  config.RESEND_API_KEY && config.EMAIL_FROM && config.ADMIN_NOTIFY_EMAIL,
);

/** Sends to the admin through Resend's HTTP API (no SDK needed). */
let mailer: Mailer = async ({ subject, text }) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.EMAIL_FROM,
      to: [config.ADMIN_NOTIFY_EMAIL],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
};

/** Tests swap in a fake mailer. */
export function setMailer(fn: Mailer) {
  mailer = fn;
}

export async function emailAdmin(email: Email) {
  if (!emailEnabled) return false;
  try {
    await mailer(email);
    return true;
  } catch (err) {
    console.error('admin email failed', err);
    return false;
  }
}
