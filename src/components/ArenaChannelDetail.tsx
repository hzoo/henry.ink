import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { arenaQueryKeys, formatRelativeTime } from "@/src/lib/arena-api";
import { navigateToChannelList } from "@/src/lib/arena-navigation";
import type { ArenaMatch, ArenaBlock } from "@/src/lib/arena-types";
import type { ArenaChannelBlocksResponse } from "@/api/arena/routes";
import { ArenaBlockItem } from "./ArenaChannelItem";
import { useEffect, useRef } from "preact/hooks";

interface ArenaChannelDetailProps {
  channel: ArenaMatch;
}

export function ArenaChannelDetail({ channel }: ArenaChannelDetailProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const initialData = queryClient.getQueryData(arenaQueryKeys.blocks(channel.slug, 24, 1));

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery<ArenaChannelBlocksResponse, Error>({
    queryKey: arenaQueryKeys.blocks(channel.slug),
    initialPageParam: 1,
    initialData: initialData ? {
      pages: [initialData as ArenaChannelBlocksResponse],
      pageParams: [1]
    } : undefined,
    persister: undefined, // Disable persistence for infinite queries
    queryFn: async ({ pageParam = 1 }) => {
      const apiUrl = import.meta.env.VITE_ARENA_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${apiUrl}/api/arena/channel-blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          slug: channel.slug, 
          per: 24,
          page: pageParam 
        }),
      });

      if (!response.ok) {
        throw new Error(`Arena service returned ${response.status}`);
      }

      const result = await response.json() as ArenaChannelBlocksResponse;
      
      if (!result || typeof result !== 'object') {
        return { blocks: [] };
      }
      
      if (result.error) {
        throw new Error(result.message || result.error);
      }
      
      if (!result.blocks || !Array.isArray(result.blocks)) {
        return { ...result, blocks: [] };
      }

      return result;
    },
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      if (!lastPage?.blocks || lastPage.blocks.length < 24) {
        return undefined;
      }
      return (lastPageParam as number) + 1;
    },
    staleTime: 10 * 60 * 1000, // override global infinity
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const blocks = data?.pages?.flatMap((page: ArenaChannelBlocksResponse) => page?.blocks || []) || [];

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-3 z-10">
        <button
          onClick={navigateToChannelList}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors mb-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Channels
        </button>
        
        <div>
          <h2 className="text-lg font-semibold">
            <a 
              href={channel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 transition-colors"
            >
              {channel.title}
              <svg className="inline-block w-3 h-3 ml-1 mb-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </h2>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>
              by{' '}
              {channel.author_slug ? (
                <a
                  href={`https://are.na/${channel.author_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-700 dark:hover:text-gray-300 underline"
                >
                  {channel.author_name}
                </a>
              ) : (
                channel.author_name
              )}
            </span>
            <span>•</span>
            <span>{channel.contents_count} blocks</span>
            {channel.updated_at && (
              <>
                <span>•</span>
                <span>Updated {formatRelativeTime(channel.updated_at)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Blocks grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-green-500 rounded-full animate-spin" />
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              Loading blocks...
            </span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {error.message?.includes("404") ? "Channel not accessible" : "Failed to load blocks"}
            </div>
          </div>
        ) : blocks.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              No blocks in this channel
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {blocks.map((block: ArenaBlock) => (
              <div key={block.id} className="w-full">
                <ArenaBlockItem block={block} />
              </div>
            ))}
          </div>
        )}

        {/* Infinite scroll trigger and loading indicator */}
        <div 
          ref={loadMoreRef} 
          className="py-4 flex justify-center min-h-[100px]" 
          style={{ backgroundColor: hasNextPage ? 'rgba(34, 197, 94, 0.05)' : 'transparent' }}
        >
          {isFetchingNextPage && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-green-500 rounded-full animate-spin" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading more blocks...</span>
            </div>
          )}
          {!hasNextPage && blocks.length > 0 && (
            <div className="flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">End of channel</span>
              <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}