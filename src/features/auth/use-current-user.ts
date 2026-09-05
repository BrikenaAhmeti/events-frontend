import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api/api-client';
import { authKeys } from '../../lib/api/query-keys';
import type { CurrentUser } from '../../types/domain';

export const useCurrentUser = () =>
  useQuery({
    queryKey: authKeys.me(),
    queryFn: ({ signal }) => apiClient.get<CurrentUser>('/auth/me', signal),
    staleTime: 60_000,
    retry: (count, error) =>
      !(error instanceof ApiError && error.response.statusCode === 401) && count < 1,
  });
