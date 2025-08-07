import { useSignal } from "@preact/signals-react/runtime";
import { useQuery } from "@tanstack/react-query";
import { LoadingItemList } from "@/src/components/LoadingItem";
import { ErrorMessage } from "@/src/components/ErrorMessage";
import { ArenaChannelItem } from "@/src/components/ArenaChannelItem";
import { contentStateSignal, arenaViewModeSignal } from "@/henry-ink/signals";
import { fetchArenaMatches, arenaQueryKeys } from "@/src/lib/arena-api";
import { currentUrl } from "@/src/lib/messaging";

/**
 * Self-contained component that fetches and displays arena matches
 * No external dependencies - fetches its own data based on page content
 */
export function ArenaChannelList() {
  const userDismissedError = useSignal(false);
  const contentState = contentStateSignal.value;
  const viewMode = arenaViewModeSignal.value;

  // Fetch arena matches based on page content
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

  // Group matches by matched text to identify duplicates
  const matchTextCounts = matches.reduce((acc, match) => {
    acc[match.matchedText] = (acc[match.matchedText] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Reset dismissed error when query key changes
  if (isError && error && userDismissedError.value) {
    userDismissedError.value = false;
  }

  if (contentState.type === 'loading') {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Loading page content...
        </div>
      </div>
    );
  }

  if (contentState.type === 'error') {
    return (
      <div className="p-4">
        <ErrorMessage
          message={contentState.message || 'Failed to load page content'}
          onDismiss={() => {}}
        />
      </div>
    );
  }

  if (contentState.type !== 'success' || !contentState.content) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          No content available
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingItemList length={3} />;
  }

  if (isError && error && !userDismissedError.value) {
    return (
      <div className="p-4">
        <ErrorMessage
          message={error.message}
          onDismiss={() => userDismissedError.value = true}
        />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          No Arena channels found
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {matches.map((match, index) => (
        <ArenaChannelItem
          key={`${match.slug}-${index}`}
          match={match}
          index={index}
          matchTextCounts={matchTextCounts}
          viewMode={viewMode}
        />
      ))}
    </div>
  );
}