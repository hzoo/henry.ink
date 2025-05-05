import { currentPosts } from "@/lib/signals";
import type { AppBskyFeedDefs } from "@atcute/client/lexicons";

import { FullPost } from "./post/FullPost";

export function PostList() {
  return (
    <>
      {currentPosts.value.map((post: AppBskyFeedDefs.PostView) => (
        <FullPost key={post.cid} postUri={post.uri} />
      ))}
      <div className="pb-96" />
    </>
  );
} 