import { contentItems, mode } from "@/lib/signals";
import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { FullPost } from "./post/FullPost";
import { CompactPost } from "./post/CompactPost";

export function PostList() {
  const PostComponent = mode.value === 'full' ? FullPost : CompactPost;

  return (
    <div className="space-y-0">
      {contentItems.value.map((post: PostView) => (
        <PostComponent
          key={post.cid}
          post={post}
        />
      ))}
    </div>
  );
} 