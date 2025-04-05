import { currentPosts, mode } from "@/lib/signals";
import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { FullPost } from "./post/FullPost";
import { CompactPost } from "./post/CompactPost";

export function PostList() {
  const PostComponent = mode.value === 'full' ? FullPost : CompactPost;

  return (
    <>
      {currentPosts.value.map((post: PostView, index: number) => (
        <PostComponent
          key={post.cid}
          post={post}
          expanded={index === 0}
        />
      ))}
    </>
  );
} 