import { Fragment, type JSX } from "preact";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import {
	segmentize,
	type FacetFeature,
} from "@atcute/bluesky-richtext-segmenter";

import { isRecord } from "@/src/lib/postActions";
import { getPost } from "@/src/lib/utils/postUrls";
import { currentUrl } from "@/src/lib/messaging";
import { sameArticle } from "@/src/lib/annotations/anchors";

interface Props {
	post: AppBskyFeedDefs.PostView;
}

export function PostText(props: Props) {
	const { post } = props;
	const { record } = post;
	const postRecord = isRecord(record) ? record : null;
	const text = postRecord?.text ?? "";
	const facets = postRecord?.facets ?? [];
	const tags = postRecord?.tags ?? [];

	const segments = segmentize(text, facets);

	const content: { text: string; component: JSX.Element }[] = [];

	for (const segment of segments) {
		const feature = segment.features?.[0] as FacetFeature | undefined; // Assuming one feature per segment for simplicity based on context

		if (feature && feature.$type === "app.bsky.richtext.facet#mention") {
			content.push({
				text: segment.text,
				component: (
					<>
						{feature.did && (
							<a
								className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline dark:underline break-after-auto"
								target="_blank"
								rel="noopener noreferrer"
								href={`https://bsky.app/profile/${encodeURIComponent(feature.did)}`}
								onClick={(e: MouseEvent) => e.stopPropagation()}
							>
								{segment.text}
							</a>
						)}
					</>
				),
			});
		} else if (feature && feature.$type === "app.bsky.richtext.facet#link") {
			const url = feature.uri;
			if (url && sameArticle(url, currentUrl.value)) {
				const postUrl = getPost(post.uri);
				content.push({
					text: "",
					component: (
						<a
							href={postUrl}
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Open post on Bluesky"
							title="Open post on Bluesky"
							className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline text-xs"
							onClick={(e: MouseEvent) => e.stopPropagation()}
						>
							[↗]
						</a>
					),
				});
				continue;
			}
			content.push({
				text: segment.text,
				component: (
					<a
						className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline dark:underline break-all"
						href={feature.uri}
						target="_blank"
						rel="noopener noreferrer"
						onClick={(e: MouseEvent) => e.stopPropagation()}
					>
						{segment.text}
					</a>
				),
			});
		} else if (feature && feature.$type === "app.bsky.richtext.facet#tag") {
			const encodedTag = encodeURIComponent(feature.tag);
			content.push({
				text: segment.text,
				component: (
					<a
						href={`https://bsky.app/hashtag/${encodedTag}`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline dark:underline"
						onClick={(e: MouseEvent) => e.stopPropagation()}
					>
						{segment.text}
					</a>
				),
			});
		} else {
			content.push({
				text: segment.text,
				component: <span>{segment.text}</span>,
			});
		}
	}

	return (
		<div
			dir="auto"
			className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap [overflow-wrap:break-word] flex-1 text-sm"
		>
			{content.map((segment, i) => (
				<Fragment key={`${segment.text}-${i}`}>{segment.component}</Fragment>
			))}
			{tags.length > 0 && (
				<div className="flex flex-wrap gap-2 my-2">
					{tags.map((tag: string) => (
						<span
							key={tag}
							className="text-blue-600 dark:text-blue-400 text-sm"
						>
							#{tag}
						</span>
					))}
				</div>
			)}
		</div>
	);
}
