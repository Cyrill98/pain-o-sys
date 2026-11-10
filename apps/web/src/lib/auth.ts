import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Admin, LoginRequest, LoginResponse, MeResponse } from '@app/shared';
import { apiFetch } from './api';

const ME_KEY = ['auth', 'me'] as const;

/** The signed-in admin, or null when signed out. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async (): Promise<Admin | null> => (await apiFetch<MeResponse>('/auth/me')).admin,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) =>
      apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (res) => {
      queryClient.setQueryData(ME_KEY, res.admin);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      // Drop all cached admin data, then mark as signed out.
      queryClient.removeQueries();
      queryClient.setQueryData(ME_KEY, null);
    },
  });
}
