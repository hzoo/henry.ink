import type { QueryClient } from '@tanstack/react-query';
import { apiBase } from '@/src/lib/api-url';
import type { ArenaLookupPage } from '@/src/lib/arena-types';

export const arenaQueryKey = (url: string) => ['arena-url', url] as const;

// The API shares one copy of each lookup with every reader. An explicit refresh
// asks it to look again instead of returning that copy.
const refreshing = new Set<string>();

export async function lookupArenaUrl(url: string, page: number, signal?: AbortSignal): Promise<ArenaLookupPage> {
  const target = new URL('/api/arena/lookup', apiBase);
  target.searchParams.set('url', url);
  target.searchParams.set('page', String(page));
  if (refreshing.has(url)) target.searchParams.set('refresh', '1');
  const response = await fetch(target, { signal });
  if (!response.ok) throw new Error('Couldn’t load Are.na saves.');
  return response.json();
}

export async function refreshArenaUrl(client: QueryClient, url: string): Promise<void> {
  refreshing.add(url);
  try { await client.invalidateQueries({ queryKey: arenaQueryKey(url) }); }
  finally { refreshing.delete(url); }
}
