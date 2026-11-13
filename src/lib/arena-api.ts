import { apiBase } from '@/src/lib/api-url';
import type { ArenaLookupPage } from '@/src/lib/arena-types';

export const arenaQueryKey = (url: string) => ['arena-url', url] as const;

export async function lookupArenaUrl(url: string, page: number, signal?: AbortSignal): Promise<ArenaLookupPage> {
  const target = new URL('/api/arena/lookup', apiBase);
  target.searchParams.set('url', url);
  target.searchParams.set('page', String(page));
  const response = await fetch(target, { signal });
  if (!response.ok) throw new Error('Couldn’t load Are.na saves.');
  return response.json();
}
