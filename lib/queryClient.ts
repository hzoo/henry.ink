import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const queryClient = new QueryClient();

const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'bsky-search', // Optional: customize the localStorage key
  throttleTime: 1000,
});

persistQueryClient({
  queryClient,
  persister: localStoragePersister,
  maxAge: Number.POSITIVE_INFINITY, // Persist data indefinitely
  // You might also consider a dehydrate/hydrate options here if needed later for complex data types
}); 