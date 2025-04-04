import { useEffect, useRef } from "react";
import { useSignal } from "@preact/signals";
import type { ThreadViewPost } from '@atproto/api/dist/client/types/app/bsky/feed/defs';
import { AppBskyFeedDefs } from "@atproto/api";
import { getPostThread } from "@/lib/bsky";
import { CompactPost } from "./CompactPost";
import type { PostRepliesProps, ThreadReply } from "@/lib/types";

function processThreadReplies(thread: ThreadViewPost): ThreadReply[] {
  if (!thread.replies) return [];

  return thread.replies
    .filter(AppBskyFeedDefs.isThreadViewPost)
    .map(reply => ({
      post: reply.post,
      replies: reply.replies ? processThreadReplies(reply as ThreadViewPost) : undefined
    }));
}

export function PostReplies({ 
  post, 
  isExpanded,
  depth = 0,
  maxDepth = 6, // Limit maximum nesting depth for UI clarity
  prefetchedReplies,
}: PostRepliesProps) {
  const replyCount = post.replyCount;
  const isLoading = useSignal(false);
  const replies = useSignal<ThreadReply[]>(prefetchedReplies || []);
  const hasFetched = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only fetch once when first expanded
  useEffect(() => {
    // Skip if we have prefetched replies or if we've already fetched
    if (prefetchedReplies || hasFetched.current) return;

    // Only fetch if expanded
    if (!isExpanded.value) return;

    let abortController: AbortController | null = null;

    async function loadReplies() {
      if (replyCount && replyCount > 0 && replies.value.length === 0) {
        isLoading.value = true;
        abortController = new AbortController();
        try {
          const thread = await getPostThread(post.uri, { depth: maxDepth, signal: abortController.signal });
          if (thread && AppBskyFeedDefs.isThreadViewPost(thread)) {
            replies.value = processThreadReplies(thread as ThreadViewPost);
            hasFetched.current = true;
          }
        } catch (error) {
          console.error('Error loading replies:', error);
        } finally {
          isLoading.value = false;
        }
      }
    }

    loadReplies();
    return () => abortController?.abort();
  }, [isExpanded.value]);

  if (!isExpanded.value) {
    return null;
  }

  // Don't render beyond max depth
  if (depth >= maxDepth) {
    return replies.value.length > 0 ? (
      <div className="ml-6 pl-2 text-sm text-gray-500 border-l border-gray-200 dark:border-gray-700">
        {replies.value.length} more replies...
      </div>
    ) : null;
  }

  return (
    <>
      {isLoading.value ? (
        <div className="pl-2 py-1 text-sm text-gray-500">Loading replies...</div>
      ) : (
        replies.value.map((reply) => (
          <CompactPost
            key={reply.post.cid}
            post={reply.post}
            depth={depth}
            expanded={isExpanded.value}
            replies={reply.replies}
          />
        ))
      )}
    </>
  );
}