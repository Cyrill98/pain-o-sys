import { useQuery } from '@tanstack/react-query';
import type { Color, CreateRequest, CreateRequestResponse, PublicSettings } from '@app/shared';
import { ApiRequestError, apiFetch, apiSend } from './api';
import { apiErrorSchema } from '@app/shared';

export function usePublicSettings() {
  return useQuery({
    queryKey: ['settings', 'public'],
    queryFn: () => apiFetch<PublicSettings>('/settings/public'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useColors() {
  return useQuery({
    queryKey: ['colors'],
    queryFn: async () => (await apiFetch<{ colors: Color[] }>('/colors')).colors,
    staleTime: 5 * 60 * 1000,
  });
}

/** Upload one photo (raw bytes). Returns its id. */
export async function uploadImage(blob: Blob): Promise<string> {
  let res: Response;
  try {
    res = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'image/jpeg' },
      body: blob,
      credentials: 'same-origin',
    });
  } catch {
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
  return (body as { id: string }).id;
}

export const createRequest = (body: CreateRequest) =>
  apiSend<CreateRequestResponse>('POST', '/requests', body);

export const reportWhatsappOpened = (id: string, token: string) =>
  apiSend<void>('POST', `/requests/${id}/opened`, { token });
