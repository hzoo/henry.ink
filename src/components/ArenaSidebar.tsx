import { useSignal } from "@preact/signals-react/runtime";
import { useQuery } from "@tanstack/react-query";
import { LoadingItemList } from "@/src/components/LoadingItem";
import { ErrorMessage } from "@/src/components/ErrorMessage";
import { contentStateSignal } from "@/henry-ink/signals";
import { arenaNavigationRequest } from "@/src/lib/messaging";
import { fetchArenaMatches, arenaQueryKeys } from "@/src/lib/arena-api";
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
    queryKey: arenaQueryKeys.matches(contentState.type === 'success' ? contentState.content : null),
    queryFn: () => fetchArenaMatches(contentState.type === 'success' ? contentState.content : ''),
    enabled: contentState.type === 'success' && !!contentState.content,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Group matches by matched text to identify duplicates
  const matchTextCounts = matches.reduce((acc, match) => {
    acc[match.matchedText] = (acc[match.matchedText] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Handle navigation to text position
  const handleNavigateToMatch = (match: ArenaMatch) => {
    arenaNavigationRequest.value = { matchedText: match.matchedText };
  };

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
      ) : matches.length === 0 ? (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          <div className="mb-2">🔍</div>
          <div className="text-sm">No Arena channels found for this content</div>
        </div>
      ) : (
        <>
          {matches.map((match, index) => (
            <div key={`${match.slug}-${index}`} className="p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="mb-3">
                <a 
                  href={match.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium text-sm leading-tight block hover:underline"
                >
                  {match.title}
                </a>
              </div>
              
              <div className="mb-2">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Match: <button 
                    onClick={() => handleNavigateToMatch(match)}
                    className="bg-yellow-100 dark:bg-yellow-900/30 px-1 py-0.5 rounded text-yellow-800 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 cursor-pointer transition-colors"
                    title="Click to navigate to this text in the article"
                  >
                    "{match.matchedText}"
                  </button>
                  {matchTextCounts[match.matchedText] > 1 && (
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                      (+{matchTextCounts[match.matchedText] - 1} similar)
                    </span>
                  )}
                </span>
              </div>
              
              <blockquote className="text-xs text-gray-700 dark:text-gray-300 italic pl-2 border-l-2 border-gray-200 dark:border-gray-600 leading-relaxed">
                ...{match.context}...
              </blockquote>
            </div>
          ))}
        </>
      )}
    </div>
  );
}