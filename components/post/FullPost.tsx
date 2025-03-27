import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { PostText } from "../PostText";
import { BasePost, type BasePostProps } from "./BasePost";

export function FullPost({ post, showReplies, onToggleReplies }: BasePostProps) {
  const {
    handlePostClick,
    handleAuthorClick,
    authorName,
    authorHandle,
    avatar,
    timeAgo,
    replyCount,
    repostCount,
    likeCount
  } = BasePost({ post, showReplies, onToggleReplies });

  return (
    <article 
      className="border-b p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      onClick={handlePostClick}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center">
          {avatar && (
            <img 
              src={avatar} 
              alt={authorName}
              className="w-10 h-10 rounded-full mr-3 flex-shrink-0"
            />
          )}
          <div className="flex items-center flex-wrap gap-x-1 min-w-0">
            <span className="font-semibold text-base truncate">
              {authorName}
            </span>
            <button 
              onClick={handleAuthorClick}
              className="text-gray-500 hover:underline"
            >
              @{authorHandle}
            </button>
            <span className="text-gray-500">·</span>
            <span className="text-gray-500 hover:underline">
              {timeAgo}
            </span>
          </div>
        </div>
        <PostText record={post.record} truncate={false} />
        <div className="flex items-center gap-4 text-gray-500 text-sm">
          {replyCount !== undefined && (
            <span>{replyCount} replies</span>
          )}
          {repostCount !== undefined && (
            <span>{repostCount} reposts</span>
          )}
          {likeCount !== undefined && (
            <span>{likeCount} likes</span>
          )}
        </div>
      </div>
    </article>
  );
} 