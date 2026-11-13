import { useInfiniteQuery } from '@tanstack/react-query';
import { arenaQueryKey, lookupArenaUrl } from '@/src/lib/arena-api';
import { currentUrl, isSearchableUrl } from '@/src/lib/messaging';
import type { ArenaUrlBlock } from '@/src/lib/arena-types';
import { LoadingItemList } from '@/src/components/LoadingItem';
import { ArenaResults, arenaBlockUrl } from '@/src/components/ArenaResults';

const linkClass = 'inline-flex min-h-10 items-center text-xs text-gray-500 hover:text-gray-950 hover:underline dark:text-gray-400 dark:hover:text-white';
const buttonClass = 'min-h-10 rounded-md px-3 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-gray-500 dark:text-gray-300 dark:hover:bg-gray-800';

export function ArenaSidebar() {
  const url = currentUrl.value;
  const query = useInfiniteQuery({
    queryKey: arenaQueryKey(url), initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => lookupArenaUrl(url, pageParam, signal),
    getNextPageParam: page => page.nextPage ?? undefined,
    enabled: isSearchableUrl.value, staleTime: 5 * 60 * 1000, gcTime: 5 * 60 * 1000,
    retry: false, persister: undefined,
  });
  const blocks = new Map<number, ArenaUrlBlock>();
  for (const page of query.data?.pages ?? []) for (const block of page.blocks) blocks.set(block.id, block);
  const incomplete = [...blocks.values()].filter(block => block.channels.state === 'error' || block.channels.hasMore);

  if (!isSearchableUrl.value) return <p class="p-4 text-sm text-gray-500">Open a web page to find its Are.na saves.</p>;
  if (query.isLoading) return <LoadingItemList length={3} />;
  if (query.isError && !query.data) return <div class="p-4" role="alert">
    <p class="text-sm text-gray-600 dark:text-gray-400">Couldn’t load Are.na saves.</p>
    <button type="button" class={buttonClass} onClick={() => query.refetch()}>Try again</button>
  </div>;

  return <div class="h-full min-h-0 overflow-y-auto overscroll-contain" aria-busy={query.isFetching}>
    {!blocks.size && <p class="p-4 text-sm text-gray-500 dark:text-gray-400">No matching saves found.</p>}
    {!!blocks.size && <ArenaResults blocks={[...blocks.values()]} url={url} hasMore={!!query.hasNextPage} />}
    {!!incomplete.length && <div class="px-3 py-2">
      {incomplete.some(block => block.channels.state === 'error') && <>
        <p class="text-xs text-gray-500" role="status">Some channels couldn’t be loaded.</p>
        <button type="button" class={buttonClass} onClick={() => query.refetch()}>Try again</button>
      </>}
      {incomplete.filter(block => block.channels.state === 'ready').map(block => <a key={block.id} href={arenaBlockUrl(block.id)} target="_blank" rel="noopener noreferrer" class={linkClass}>More channels for #{block.id} on Are.na</a>)}
    </div>}
    {query.hasNextPage && <div class="p-2">
      {query.isFetchNextPageError && <p class="px-3 text-xs text-gray-500" role="alert">More results couldn’t be loaded.</p>}
      <button type="button" class={buttonClass} disabled={query.isFetching} onClick={() => query.fetchNextPage()}>
        {query.isFetchingNextPage ? 'Loading…' : query.isFetchNextPageError ? 'Try again' : 'Load more results'}
      </button>
    </div>}
  </div>;
}
