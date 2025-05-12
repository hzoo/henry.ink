import { CompactPost } from "@/components/post/CompactPost";
import type { PostRepliesProps } from "@/lib/types";

const MAX_DEPTH = 10;

export function PostReplies({ 
  replies,
  isExpanded,
  depth = 0,
  op,
  filters,
}: PostRepliesProps) {
  if (!isExpanded.value || !replies) {
    return null;
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
      {replies?.map((replyItem) => (
        <CompactPost
          key={replyItem.post.cid}
          post={replyItem.post}
          replies={replyItem.replies}
          depth={depth}
          expanded={true}
          op={op}
          filters={filters}
        />
      ))}
    </>
  );
}