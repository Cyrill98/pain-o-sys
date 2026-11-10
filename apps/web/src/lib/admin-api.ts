import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminRequest,
  AdminRequestSummary,
  AdminSettings,
  Color,
  ColorInput,
  ColorPatch,
  RequestPatch,
  RequestStatus,
  SettingsPatch,
} from '@app/shared';
import { apiFetch, apiSend } from './api';

const keys = {
  requests: (status?: RequestStatus) => ['admin', 'requests', status ?? 'all'] as const,
  request: (id: string) => ['admin', 'request', id] as const,
  newCount: ['admin', 'new-count'] as const,
  colors: ['admin', 'colors'] as const,
  settings: ['admin', 'settings'] as const,
};

export function useRequests(status?: RequestStatus) {
  return useQuery({
    queryKey: keys.requests(status),
    queryFn: async () =>
      (
        await apiFetch<{ requests: AdminRequestSummary[] }>(
          `/admin/requests${status ? `?status=${status}` : ''}`,
        )
      ).requests,
    refetchInterval: 30_000,
  });
}

export function useNewCount() {
  return useQuery({
    queryKey: keys.newCount,
    queryFn: async () => (await apiFetch<{ count: number }>('/admin/requests/new-count')).count,
    refetchInterval: 30_000,
  });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: keys.request(id ?? ''),
    queryFn: () => apiFetch<AdminRequest>(`/admin/requests/${id}`),
    enabled: Boolean(id),
  });
}

export function usePatchRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: RequestPatch) =>
      apiSend<AdminRequest>('PATCH', `/admin/requests/${id}`, patch),
    onSuccess: (data) => {
      qc.setQueryData(keys.request(id), data);
      void qc.invalidateQueries({ queryKey: ['admin', 'requests'] });
      void qc.invalidateQueries({ queryKey: keys.newCount });
    },
  });
}

export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSend<void>('DELETE', `/admin/requests/${id}`),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: keys.request(id) });
      void qc.invalidateQueries({ queryKey: ['admin', 'requests'] });
      void qc.invalidateQueries({ queryKey: keys.newCount });
    },
  });
}

export function useAdminColors() {
  return useQuery({
    queryKey: keys.colors,
    queryFn: async () => (await apiFetch<{ colors: Color[] }>('/admin/colors')).colors,
  });
}

function useColorMutation<T>(fn: (arg: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.colors });
      void qc.invalidateQueries({ queryKey: ['colors'] });
    },
  });
}

export const useCreateColor = () =>
  useColorMutation((c: ColorInput) => apiSend<Color>('POST', '/admin/colors', c));
export const useUpdateColor = () =>
  useColorMutation((a: { id: string; patch: ColorPatch }) =>
    apiSend<Color>('PATCH', `/admin/colors/${a.id}`, a.patch),
  );
export const useDeleteColor = () =>
  useColorMutation((id: string) => apiSend<void>('DELETE', `/admin/colors/${id}`));
export const useImportColors = () =>
  useColorMutation((colors: ColorInput[]) =>
    apiSend<{ imported: number }>('POST', '/admin/colors/import', { colors }),
  );

export function useAdminSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: () => apiFetch<AdminSettings>('/admin/settings'),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => apiSend<AdminSettings>('PATCH', '/admin/settings', patch),
    onSuccess: (data) => {
      qc.setQueryData(keys.settings, data);
      void qc.invalidateQueries({ queryKey: ['settings', 'public'] });
    },
  });
}

/** Admin-only photo URL (the session cookie authorizes it). */
export const photoUrl = (id: string) => `/api/admin/uploads/${id}`;
