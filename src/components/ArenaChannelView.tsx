import { useQuery } from "@tanstack/react-query";
import { ArenaChannelDetail } from "@/src/components/ArenaChannelDetail";
import { LoadingItemList } from "@/src/components/LoadingItem";
import { ErrorMessage } from "@/src/components/ErrorMessage";
import { navigateToChannelList } from "@/src/lib/arena-navigation";
import { fetchChannelBlocks, arenaQueryKeys } from "@/src/lib/arena-api";
import type { ArenaMatch } from "@/src/lib/arena-types";

interface ArenaChannelViewProps {
  channelSlug: string;
}

/**
 * Self-contained wrapper that fetches channel data and renders ArenaChannelDetail
 * Enables deep linking by loading channel data independently
 */
export function ArenaChannelView({ channelSlug }: ArenaChannelViewProps) {
  // Fetch channel data directly by slug
  const {
    data: channelData,
    isLoading,
    error,
    isError
  } = useQuery({
    queryKey: arenaQueryKeys.blocks(channelSlug, 24, 1),
    queryFn: () => fetchChannelBlocks(channelSlug, 24, 1),
    enabled: !!channelSlug,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });

  if (isLoading) {
    return <LoadingItemList />;
  }

  if (isError || !channelData) {
    return (
      <div className="p-4">
        <ErrorMessage
          message={error?.message || 'Channel not found'}
          onDismiss={navigateToChannelList}
        />
        <button
          onClick={navigateToChannelList}
          className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to channels
        </button>
      </div>
    );
  }

  // Create ArenaMatch object from channel data for compatibility
  const channel: ArenaMatch = {
    slug: channelSlug,
    title: channelData.title,
    url: `https://are.na/channels/${channelSlug}`,
    author_name: channelData.user.name,
    author_slug: channelData.user.slug,
    contents_count: channelData.length,
    updated_at: channelData.updated_at,
    matchedText: '',
    context: ''
  };

  return <ArenaChannelDetail channel={channel} />;
}