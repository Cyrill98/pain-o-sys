import { apiErrorSchema } from '@app/shared';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    /** Full response body, for errors that carry extra data (e.g. AFFECTED_BOOKINGS). */
    public readonly body: unknown = null,
  ) {
    super(code);
  }
}

/** Fetch JSON from the API; throws ApiRequestError with the server's error code on failure. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      credentials: 'same-origin',
    });
  } catch {
    // Offline, DNS failure, server down…
    throw new ApiRequestError(0, 'NETWORK');
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new ApiRequestError(
      res.status,
      parsed.success ? parsed.data.error.code : 'UNKNOWN',
      body,
    );
  }
  return body as T;
}

/** JSON request helper: apiSend('PUT', '/admin/x', body). */
export function apiSend<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
) {
  return apiFetch<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
