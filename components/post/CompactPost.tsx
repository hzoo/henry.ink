import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { PostText } from "../PostText";
import { BasePost, type BasePostProps } from "./BasePost";

export function CompactPost({ post, showReplies, onToggleReplies }: BasePostProps) {
  const {
    handlePostClick,
    handleAuthorClick,
    authorHandle,
    timeAgo,
    replyCount
  } = BasePost({ post, showReplies, onToggleReplies, isCompact: true });

  return (
    <article className="border-l border-gray-200 dark:border-gray-700">
      <div className="flex items-start gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleReplies?.();
          }}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1"
        >
          [{showReplies ? '-' : '+'}]
        </button>
        <div className="flex-1 min-w-0" onClick={handlePostClick}>
          <div className="flex items-center gap-x-1 text-sm">
            <button 
              onClick={handleAuthorClick}
              className="text-gray-500 hover:underline"
        >
              @{authorHandle}
            </button>
            <span className="text-gray-400">·</span>
            <span className="text-gray-400">{timeAgo}</span>
            {replyCount !== undefined && replyCount > 0 && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-gray-400">{replyCount} replies</span>
              </>
            )}
          </div>
          <div className="text-sm">
            <PostText record={post.record} truncate={true} />
          </div>
        </div>
      </div>
    </article>
  );
} 