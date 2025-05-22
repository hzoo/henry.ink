import { CompactPost } from "@/components/post/CompactPost";
import type { Signal } from "@preact/signals";
import type { PostFilter } from "@/lib/postFilters";
import type { DisplayableItem } from "@/components/post/FullPost";
import type { Thread } from "@/lib/threadUtils";

const MAX_DEPTH = 10;

interface PostRepliesProps {
	replies: Thread[] | undefined;
	isExpanded: Signal<boolean>;
	depth?: number;
	op?: string;
	filters?: PostFilter[];
	displayItems: DisplayableItem[];
}

export function PostReplies({
	replies,
	isExpanded,
	depth = 0,
	op,
	filters,
	displayItems,
}: PostRepliesProps) {
	if (!isExpanded.value || !replies) {
		return null;
	}

	if (depth >= MAX_DEPTH) {
		return replies && replies.length > 0 ? (
			<div className="ml-6 pl-2 text-sm text-gray-500 border-l border-gray-200 dark:border-gray-700">
				{replies.length} more replies...
			</div>
		) : null;
	}

	return (
		<>
			{replies?.map((replyItem) => {
				return (
					<CompactPost
						key={replyItem.post.cid}
						post={replyItem.post}
						replies={replyItem.replies}
						depth={depth}
						expanded={true}
						op={op}
						filters={filters}
						displayItems={displayItems}
					/>
				);
			})}
		</>
	);
}
