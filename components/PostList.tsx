import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { FullPost } from "./post/FullPost";
import type { PostFilter } from "@/lib/postFilters";
import { Filters } from "@/lib/postFilters";

export interface PostListProps {
  posts: AppBskyFeedDefs.PostView[];
}

const filters: PostFilter[] = [
  // Filters.MinInteractionCount(1),
  Filters.NoPins,
  Filters.MaxTags(3),
  Filters.BotPost,
];

export function PostList({ posts }: PostListProps) {
  return (
    <>
      {posts.map((post: AppBskyFeedDefs.PostView) => (
        <FullPost key={post.cid} postUri={post.uri} filters={filters} />
      ))}
      <div className="pb-96" />
    </>
  );
} 