import type { AppBskyFeedDefs } from "@atcute/client/lexicons";

export function PostEmbed({ post }: { post: AppBskyFeedDefs.PostView }) {
	if (!post.embed) return null;

	if (post.embed.$type === "app.bsky.embed.images#view") {
		return (
			<img
				src={post.embed.images[0].thumb}
				alt={post.embed.images[0].alt}
				className="w-full h-full object-cover p-1 rounded-md"
			/>
		);
	}

	//   if (post.embed.$type === 'app.bsky.embed.external#view') {
	//     return <div>{post.embed.external.uri}</div>;
	//   }

	//   if (post.embed.$type === 'app.bsky.embed.record#view') {
	//     return <div>{post.embed.record.uri}</div>;
	//   }

	//   if (post.embed.$type === 'app.bsky.embed.video#view') {
	//     return <div>{post.embed.thumbnail}</div>;
	//   }

	return null;
}
