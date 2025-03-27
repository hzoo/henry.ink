import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { PostText } from "../PostText";
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
  const handlePostClick = () => {
    window.open(`https://bsky.app/profile/${post.author.handle}/post/${getPostId(post.uri)}`, '_blank');
  };

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://bsky.app/profile/${post.author.handle}`, '_blank');
  };

  return {
    post,
    handlePostClick,
    handleAuthorClick,
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