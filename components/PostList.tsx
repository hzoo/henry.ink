import { contentItems, mode } from "@/lib/signals";
import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { FullPost } from "./post/FullPost";
import { CompactPost } from "./post/CompactPost";
import { signal } from "@preact/signals";

const expandedPosts = signal<Set<string>>(new Set());

export function PostList() {
  const toggleReplies = (postUri: string) => {
    const newSet = new Set(expandedPosts.value);
    if (newSet.has(postUri)) {
      newSet.delete(postUri);
    } else {
      newSet.add(postUri);
    }
    expandedPosts.value = newSet;
  };

  const PostComponent = mode.value === 'full' ? FullPost : CompactPost;

  return (
    <div className="space-y-0">
      {contentItems.value.map((post: PostView) => (
        <PostComponent
          key={post.cid}
          post={post}
          showReplies={expandedPosts.value.has(post.uri)}
          onToggleReplies={() => toggleReplies(post.uri)}
        />
      ))}
    </div>
  );
} 