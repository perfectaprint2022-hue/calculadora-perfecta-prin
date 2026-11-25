import {
  getAuthGetCurrentUserQueryKey,
  useAuthGetCurrentUser,
} from "@workspace/api-client-react";

export function useAuthSession() {
  const query = useAuthGetCurrentUser({
    query: {
      retry: false,
      refetchOnWindowFocus: false,
      queryKey: getAuthGetCurrentUserQueryKey(),
    },
  });

  return {
    user: query.data?.user ?? null,
    loading: query.isLoading,
  };
}
