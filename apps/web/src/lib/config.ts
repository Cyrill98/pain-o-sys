/** Cloudflare Turnstile site key (public). Unset in development → the widget is skipped. */
export const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || null;
