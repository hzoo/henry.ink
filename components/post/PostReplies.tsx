import { useSignalEffect } from "@preact/signals-react/runtime";
import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import { getThreadSignal } from "@/lib/signals";
import { CompactPost } from "./CompactPost";
import type { PostRepliesProps } from "@/lib/types";
import { fetchAndUpdateThreadSignal } from "@/lib/threadUtils";

const MAX_DEPTH = 10;

export function PostReplies({ 
  post,
  isExpanded,
  depth = 0,
}: Omit<PostRepliesProps, 'prefetchedReplies'>) {
  const threadStateSignal = getThreadSignal(post.uri);
  const { data: replies, isLoading, error } = threadStateSignal.value;

  useSignalEffect(() => {
    const state = threadStateSignal.peek();
    
    if (depth === 0 && isExpanded.value && !state.data && !state.isLoading) {
       fetchAndUpdateThreadSignal(post.uri);
    }
  });

  if (!isExpanded.value || !replies) {
    return null;
  }

  if (error) {
    return <div className="ml-6 pl-2 text-sm text-red-500">Error loading replies: {error}</div>;
  }

  if (depth >= MAX_DEPTH) {
    return replies && replies.length > 0 ? (
      <div className="ml-6 pl-2 text-sm text-gray-500 border-l border-gray-200 dark:border-gray-700">
        {replies.length} more replies...
      </div>
    ) : null;
  }

  return (
    <>
      {isLoading && (!replies || replies.length === 0) ? (
        <div className="pl-2 py-1 text-sm text-gray-500">Loading replies...</div>
      ) : (
        replies?.map((reply) => (
          <CompactPost
            key={reply.post.cid}
            post={reply.post as AppBskyFeedDefs.PostView}
            depth={depth}
            expanded={isExpanded.value}
            op={post.author.handle}
          />
        ))
      )}
    </>
  );
}