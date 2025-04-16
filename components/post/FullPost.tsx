import { formatCount } from "@/lib/utils/count";
import { PostText } from "../PostText";
import { getPostUrl, getAuthorUrl } from "@/lib/utils/postUrls";
import { getTimeAgo } from "@/lib/utils/time";
import { Icon } from "@/components/Icon";
import type { AppBskyFeedDefs } from "@atcute/client/lexicons";

interface FullPostProps {
  post: AppBskyFeedDefs.PostView;
}

export function FullPost({ post }: FullPostProps) {
  const authorName = post.author.displayName || post.author.handle;
  const postUrl = getPostUrl(post.author.handle, post.uri);
  const postAuthorUrl = getAuthorUrl(post.author.handle);
  const timeAgo = getTimeAgo(post.indexedAt);

  return (
    <article 
      className="border-b border-gray-300 dark:border-gray-600 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center">
          {post.author.avatar && (
            <img 
              src={post.author.avatar} 
              alt={authorName}
              className="w-10 h-10 rounded-full mr-3 flex-shrink-0"
            />
          )}
          <div className="flex items-center flex-wrap gap-x-1 min-w-0">
            <a href={postAuthorUrl} target="_blank" rel="noopener noreferrer" className="font-semibold truncate hover:underline">
              {authorName}
            </a>
            <span className="text-gray-500">·</span>
            <a href={postAuthorUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500">
              @{post.author.handle}
            </a>
            <span className="text-gray-500">·</span>
            <a href={postUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:underline">
              {timeAgo}
            </a>
          </div>
        </div>
        <PostText record={post.record} truncate={false} />
        <div className="flex items-center gap-4 text-gray-500 text-sm">
          {post.replyCount !== undefined && (
            <span className="flex items-center gap-1">
              <Icon name="comment" className="w-3 h-3" />
              {formatCount(post.replyCount)}
            </span>
          )}
          {post.repostCount !== undefined && (
            <span className="flex items-center gap-1">
              <Icon name="arrowPath" className="w-3 h-3" />
              {formatCount(post.repostCount)}
            </span>
          )}
          {post.likeCount !== undefined && (
            <span className="flex items-center gap-1">
              <Icon name="heart" className="w-3 h-3" />
              {formatCount(post.likeCount)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
} 