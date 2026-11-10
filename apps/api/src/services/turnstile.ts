import { config } from '../config.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify a Cloudflare Turnstile token server-side.
 * With no secret configured (development/test only — production refuses to start without one),
 * verification is skipped.
 */
export async function verifyTurnstile(
  token: string,
  ip: string | undefined,
  secret: string | null = config.TURNSTILE_SECRET_KEY,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetchImpl(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false; // network failure → treat as unverified
  }
}
