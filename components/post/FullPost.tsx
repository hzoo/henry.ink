import { formatCount } from "@/lib/utils/count";
import { PostText } from "../PostText";
import { BasePost, type BasePostProps } from "./BasePost";
import { Icon } from "../Icon";

export function FullPost({ post }: BasePostProps) {
  const {
    authorName,
    authorHandle,
    avatar,
    timeAgo,
    replyCount,
    repostCount,
    likeCount,
    postUrl,
    postAuthorUrl
  } = BasePost({ post });

  return (
    <article 
      className="border-b p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
            <a href={postAuthorUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-base truncate hover:underline">
              {authorName}
            </a>
            <span className="text-gray-500">·</span>
            <a href={postAuthorUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500">
              @{authorHandle}
            </a>
            <span className="text-gray-500">·</span>
            <a href={postUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:underline">
              {timeAgo}
            </a>
          </div>
        </div>
        <PostText record={post.record} truncate={false} />
        <div className="flex items-center gap-4 text-gray-500 text-sm">
          {replyCount !== undefined && (
            <span className="flex items-center gap-1">
              <Icon name="comment" className="w-3 h-3" />
              {formatCount(replyCount)}
            </span>
          )}
          {repostCount !== undefined && (
            <span className="flex items-center gap-1">
              <Icon name="arrowPath" className="w-3 h-3" />
              {formatCount(repostCount)}
            </span>
          )}
          {likeCount !== undefined && (
            <span className="flex items-center gap-1">
              <Icon name="heart" className="w-3 h-3" />
              {formatCount(likeCount)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
} 