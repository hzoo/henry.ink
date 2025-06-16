import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { FullPost } from "./post/FullPost";
import type { PostFilter } from "@/src/lib/postFilters";
import { Filters } from "@/src/lib/postFilters";

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
				<FullPost
					key={post.cid}
					postUri={post.uri}
					filters={filters}
					displayItems={["avatar", "handle"]}
				/>
			))}
			<div className="pb-96" />
		</>
	);
}
