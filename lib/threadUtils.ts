import { batch } from "@preact/signals";
import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import { getPostThread } from "@/lib/bsky";
import { getThreadSignal } from "@/lib/signals";
import type { ThreadReply } from "@/lib/types";
import { updateThreadCache } from "@/lib/postCache";

function isThreadViewPost(v: unknown): v is AppBskyFeedDefs.ThreadViewPost {
  return typeof v === 'object' && v !== null &&
         '$type' in v &&
         v.$type === 'app.bsky.feed.defs#threadViewPost';
}

function processThreadReplies(thread: AppBskyFeedDefs.ThreadViewPost): ThreadReply[] {
  if (!thread.replies) return [];

  return thread.replies
    .filter(isThreadViewPost)
    .map(reply => ({
      post: (reply as AppBskyFeedDefs.ThreadViewPost).post,
      replies: (reply as AppBskyFeedDefs.ThreadViewPost).replies ? processThreadReplies(reply as AppBskyFeedDefs.ThreadViewPost) : undefined
    }));
}

const DEFAULT_FETCH_DEPTH = 10;

/**
 * Recursively updates the signals for nested replies based on the fetched structure.
 */
function updateNestedSignals(replies: ThreadReply[] | undefined, now: number) {
  if (!replies) return;

  for (const reply of replies) {
    const nestedSignal = getThreadSignal(reply.post.uri);
    // Update the signal for this specific reply post
    nestedSignal.value = {
      post: reply.post,
      data: reply.replies || [], // Use the pre-processed nested replies
      isLoading: false,
      error: null,
      lastFetched: now, // Use the timestamp from the main fetch
    };
    // Recurse if there are more replies
    if (reply.replies) {
      updateNestedSignals(reply.replies, now); // Pass 'now' recursively
    }
  }
}

/**
 * Clears or sets error state for nested signals.
 * Used when the main fetch fails.
 */
function clearOrErrorNestedSignals(existingReplies: ThreadReply[] | null | undefined, errorMessage: string) {
  if (!existingReplies) return;

  for (const reply of existingReplies) {
    const nestedSignal = getThreadSignal(reply.post.uri);
    const currentNestedState = nestedSignal.peek();
    // Only update if it's currently loading or doesn't have data,
    // to avoid overwriting potentially successful independent fetches.
    // Or perhaps simpler: always reflect the parent fetch error? Let's go with simpler for now.
    nestedSignal.value = {
      ...currentNestedState, // Keep potential older data? Or clear it? Let's clear for consistency.
      data: null, // Clear data on parent error
      isLoading: false,
      error: `Parent fetch failed: ${errorMessage}`, // Indicate the error cascaded
      // lastFetched remains unchanged or null
    };

    if (reply.replies) {
      clearOrErrorNestedSignals(reply.replies, errorMessage); // Recurse
    }
  }
}

/**
 * Fetches a thread, processes its replies, and updates the corresponding signal
 * for the main post AND all nested posts found within the fetched thread.
 * Handles loading and error states for the signals.
 */
export async function fetchAndUpdateThreadSignal(uri: string, options: { depth?: number } = {}) {
  const { depth = DEFAULT_FETCH_DEPTH } = options;
  const threadSignal = getThreadSignal(uri);
  const currentState = threadSignal.peek();

  if (currentState.isLoading) {
    return;
  }

  // Keep a reference to potentially stale data in case of error
  const potentiallyStaleData = currentState.data;
  const potentiallyStalePost = currentState.post;

  threadSignal.value = {
    ...currentState,
    isLoading: true,
    error: null,
  };

  try {
    const threadData = await getPostThread(uri, { depth });

    let processedReplies: ThreadReply[] | null = null;
    let post = null;
    if (threadData && isThreadViewPost(threadData)) {
        processedReplies = processThreadReplies(threadData);
        post = threadData.post;
    } else {
        processedReplies = [];
        console.warn(`[API] No valid thread view post found for: ${uri}, treating as empty.`);
    }

    // Always update cache, even if replies are empty, to signify fetch occurred
    updateThreadCache(uri, processedReplies);

    batch(() => {
      const now = Date.now();
      // Update the main signal
      threadSignal.value = {
        post,
        data: processedReplies,
        isLoading: false,
        lastFetched: now,
        error: null,
      };

      // Recursively update signals for all nested replies found in *this* fetch
      if (processedReplies) {
        updateNestedSignals(processedReplies, now); // Pass 'now'
      }
    });

  } catch (error) {
    console.error(`[API Error] Failed to load thread ${uri}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Failed to load thread";

    batch(() => {
      // Update the main signal with error, potentially keeping stale data?
      // Let's keep stale data for the main post for now.
      threadSignal.value = {
        post: potentiallyStalePost,
        data: potentiallyStaleData, // Keep potentially stale data for the main post
        isLoading: false,
        error: errorMessage,
        lastFetched: currentState.lastFetched, // Keep previous fetch time
      };
       console.error(`[Signal Error] Updated main signal for: ${uri} with error.`);

      // Clear nested signals found in the *stale* data, as the fetch failed.
      clearOrErrorNestedSignals(potentiallyStaleData, errorMessage);
      console.error(`[Signal Error] Cleared/Errored nested signals based on stale data for thread: ${uri}`);
    });
  }
} 