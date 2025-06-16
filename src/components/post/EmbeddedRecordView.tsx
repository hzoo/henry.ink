import type { AppBskyEmbedRecord, AppBskyFeedDefs } from "@atcute/bluesky";
import { PostText } from "@/src/components/post/PostText";
import { PostEmbed } from "@/src/components/post/PostEmbed";
import { getAuthorUrl, getPost } from "@/src/lib/utils/postUrls";
import { getFormattedDate, getTimeAgo } from "@/src/lib/utils/time";

interface EmbeddedRecordViewProps {
	record: AppBskyEmbedRecord.ViewRecord;
}

export function EmbeddedRecordView({ record }: EmbeddedRecordViewProps) {
	const postUrl = getPost(record.uri);
	const postAuthorUrl = getAuthorUrl(record.author.handle);
	const timeAgo = getTimeAgo(record.indexedAt);

	const postForText = {
		uri: record.uri,
		cid: record.cid,
		author: record.author,
		indexedAt: record.indexedAt,
		record: record.value,
		embeds: record.embeds,
	} as AppBskyFeedDefs.PostView;

	return (
		<article className="relative min-w-0 pl-3 mt-2 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 p-2">
			<div className="flex-1 min-w-0 pb-1">
				<div className="flex items-center gap-x-1.5 flex-wrap text-gray-500 text-sm">
					<a
						href={postAuthorUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="hover:underline font-medium text-gray-800 dark:text-gray-100 truncate max-w-[100px]"
						title={record.author.displayName ?? record.author.handle}
					>
						{record.author.handle}
					</a>
					<span className="text-gray-400">·</span>
					<a
						href={postUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-gray-400 hover:underline"
						title={getFormattedDate(record.indexedAt)}
					>
						{timeAgo}
					</a>
				</div>
				<div className="text-sm break-words text-gray-900 dark:text-gray-100">
					<PostText post={postForText} />
					{record.embeds && record.embeds.length > 0 && (
						<div className="mt-2 flex flex-col gap-2">
							{record.embeds.map((embeddedItem, index) => {
								const postWithSingleEmbed = {
									uri: record.uri,
									cid: record.cid,
									author: record.author,
									indexedAt: record.indexedAt,
									record: record.value,
									embed: embeddedItem,
								} as AppBskyFeedDefs.PostView;
								return (
									<PostEmbed
										key={`${record.uri}-${index}`}
										post={postWithSingleEmbed}
									/>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</article>
	);
}
