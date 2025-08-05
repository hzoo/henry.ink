import { useSignal } from "@preact/signals-react/runtime";
import { useQuery } from "@tanstack/react-query";
import { LoadingItemList } from "@/src/components/LoadingItem";
import { ErrorMessage } from "@/src/components/ErrorMessage";
import { ArenaChannelItem } from "@/src/components/ArenaChannelItem";
import { contentStateSignal, arenaViewModeSignal } from "@/henry-ink/signals";
import { fetchArenaMatches, arenaQueryKeys } from "@/src/lib/arena-api";
import { currentUrl } from "@/src/lib/messaging";
import type { ArenaMatch } from "@/src/lib/arena-types";

export function ArenaSidebar() {
  const userDismissedError = useSignal(false);
  const contentState = contentStateSignal.value;

  // Use shared query with consistent key
  const {
    data: matches = [],
    isLoading,
    error,
    isError
  } = useQuery({
    queryKey: arenaQueryKeys.matches(currentUrl.value || null),
    queryFn: () => fetchArenaMatches(contentState.type === 'success' ? contentState.content : ''),
    enabled: contentState.type === 'success' && !!contentState.content,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    retry: 1,
  });

  // Sort matches so channels with more content appear first for duplicate matched text
  const sortedMatches = [...matches].sort((a, b) => {
    // First sort by matched text to group duplicates together
    const textCompare = a.matchedText.localeCompare(b.matchedText);
    if (textCompare !== 0) return textCompare;
    // Then sort by contents_count descending for the same matched text
    return b.contents_count - a.contents_count;
  });

  // Group matches by matched text to identify duplicates
  const matchTextCounts = sortedMatches.reduce((acc, match) => {
    acc[match.matchedText] = (acc[match.matchedText] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Reset dismissed error when query key changes
  if (isError && error && userDismissedError.value) {
    // Reset dismissed state when error changes (new query)
    userDismissedError.value = false;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {isLoading ? (
        <LoadingItemList />
      ) : isError && !userDismissedError.value ? (
        <ErrorMessage
          message={error instanceof Error ? error.message : 'Failed to fetch Arena channels'}
          onDismiss={() => (userDismissedError.value = true)}
        />
      ) : sortedMatches.length === 0 ? (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          <div className="mb-2">🔍</div>
          <div className="text-sm">No Arena channels found for this content</div>
        </div>
      ) : (
        <>
          {sortedMatches.map((match, index) => (
            <ArenaChannelItem
              key={`${match.slug}-${index}`}
              match={match}
              index={index}
              matchTextCounts={matchTextCounts}
              viewMode={arenaViewModeSignal.value}
            />
          ))}
        </>
      )}
    </div>
  );
}