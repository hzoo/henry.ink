import { QueryClient } from '@tanstack/react-query';
import { experimental_createQueryPersister } from '@tanstack/react-query-persist-client';

export const appPersister = experimental_createQueryPersister({
  storage: window.localStorage,
  prefix: 'bsky-search-experimental',
  maxAge: 1000 * 60 * 60 * 24 * 7,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      gcTime: 1000 * 60 * 60 * 24 * 7,
      staleTime: Number.POSITIVE_INFINITY,
      persister: appPersister.persisterFn,
    },
  },
});