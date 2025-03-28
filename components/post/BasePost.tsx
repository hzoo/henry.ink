import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { getTimeAgo } from "@/lib/utils/time";

export function getPostId(uri: string) {
  return uri.split('/').pop();
}

export interface BasePostProps {
  post: PostView;
  isCompact?: boolean;
  showReplies?: boolean;
  onToggleReplies?: () => void;
}

export function BasePost({ post, isCompact, showReplies, onToggleReplies }: BasePostProps) {
  return {
    post,
    postUrl: `https://bsky.app/profile/${post.author.handle}/post/${getPostId(post.uri)}`,
    postAuthorUrl: `https://bsky.app/profile/${post.author.handle}`,
    authorName: post.author.displayName || post.author.handle,
    authorHandle: post.author.handle,
    avatar: post.author.avatar,
    timeAgo: getTimeAgo(post.indexedAt),
    replyCount: post.replyCount,
    repostCount: post.repostCount,
    likeCount: post.likeCount,
    showReplies,
    onToggleReplies,
    isCompact
  };
} 