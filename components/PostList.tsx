import { currentPosts } from "@/lib/signals";
import type { AppBskyFeedDefs } from "@atcute/client/lexicons";

import { FullPost } from "./post/FullPost";

export function PostList() {
  return (
    <>
      {currentPosts.value.map((post: AppBskyFeedDefs.PostView) => (
        <FullPost key={post.cid} post={post} />
      ))}
      <div className="pb-96" />
    </>
  );
} 