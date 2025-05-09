import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import { FullPost } from "./post/FullPost";
import type { PostFilter } from "@/lib/postFilters";
import { Filters } from "@/lib/postFilters";

export interface PostListProps {
  posts: AppBskyFeedDefs.PostView[];
}

const filters: PostFilter[] = [
  Filters.NoPins,
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