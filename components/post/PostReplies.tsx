import { useEffect } from "react";
import { useSignal } from "@preact/signals-react/runtime";
import type { PostView, ThreadViewPost } from '@atproto/api/dist/client/types/app/bsky/feed/defs';
import { AppBskyFeedDefs } from "@atproto/api";
import { getPostThread } from "@/lib/bsky";
import { CompactPost } from "./CompactPost";

interface ThreadReply {
  post: PostView;
  replies?: ThreadReply[];
}

interface PostRepliesProps {
  post: PostView;
  replyCount?: number;
  depth?: number;
  maxDepth?: number;
}

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
  replyCount, 
  depth = 0,
  maxDepth = 6 // Limit maximum nesting depth for UI clarity
}: PostRepliesProps) {
  const isLoading = useSignal(false);
  const replies = useSignal<ThreadReply[]>([]);

  useEffect(() => {
    let abortController: AbortController | null = null;

    async function loadReplies() {
      if (replyCount && replyCount > 0 && replies.value.length === 0) {
        isLoading.value = true;
        abortController = new AbortController();
        try {
          const thread = await getPostThread(post.uri, abortController.signal);
          if (thread && AppBskyFeedDefs.isThreadViewPost(thread)) {
            replies.value = processThreadReplies(thread as ThreadViewPost);
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
  }, [post.uri, replyCount]);

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
          />
        ))
      )}
    </>
  );
} 