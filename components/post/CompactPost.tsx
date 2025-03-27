import { PostText } from "../PostText";
import { BasePost, type BasePostProps } from "./BasePost";
import { useSignal } from "@preact/signals-react/runtime";
import { PostReplies } from "@/components/post/PostReplies";

export function CompactPost({ post, depth = 0 }: Omit<BasePostProps, 'showReplies' | 'onToggleReplies'> & { depth?: number }) {
  const isExpanded = useSignal(false);

  const {
    handlePostClick,
    handleAuthorClick,
    authorHandle,
    timeAgo,
    replyCount
  } = BasePost({ post, isCompact: true });

  return (
    <article className={`relative min-w-0 ${depth > 0 ? 'pl-3' : ''}`}>
      {/* Thread line */}
      {depth > 0 && (
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
      )}

      <div className="flex items-start gap-2 py-1 px-3 hover:bg-gray-50 dark:hover:bg-gray-800">
        <div className="flex-1 min-w-0" onClick={handlePostClick}>
          <div className="flex items-center gap-x-1 text-sm flex-wrap">
            <button 
              onClick={handleAuthorClick}
              className="text-gray-500 hover:underline truncate max-w-[120px]"
            >
              @{authorHandle}
            </button>
            <span className="text-gray-400 flex-shrink-0">·</span>
            <span className="text-gray-400 flex-shrink-0">{timeAgo}</span>
            {replyCount !== undefined && replyCount > 0 && (
              <>
                <span className="text-gray-400 flex-shrink-0">·</span>
                <span className="text-gray-400 flex-shrink-0">{replyCount} replies</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    isExpanded.value = !isExpanded.value;
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                >
                  [{isExpanded.value ? '-' : '+'}]
                </button>
              </>
            )}
          </div>
          <div className="text-sm break-words">
            <PostText record={post.record} truncate={true} />
          </div>
        </div>
      </div>

      {isExpanded.value && <PostReplies post={post} replyCount={replyCount} depth={depth + 1} />}
    </article>
  );
} 