import type { Signal } from "@preact/signals-core";
import { getThreadSignal, hoveredCollapsePostUri } from "@/lib/signals";
import { useComputed } from "@preact/signals-react";
import type { AppBskyFeedDefs } from "@atcute/client/lexicons";

interface ExpandButtonProps {
	post: AppBskyFeedDefs.PostView;
	isExpanded: Signal<boolean>;
}

export function ExpandButton({
	post,
	isExpanded,
}: ExpandButtonProps) {
	const threadSignal = getThreadSignal(post.uri);
	const displayedReplyCount = useComputed(() => {
		const signalData = threadSignal.value.data;
		return Array.isArray(signalData)
			? signalData.length
			: post.replyCount ?? 0;
	});
	const isHoveringThisPost = useComputed(() => hoveredCollapsePostUri.value === post.uri);

	return (
		<button
			onClick={(e) => {
				e.stopPropagation();
				isExpanded.value = !isExpanded.value;
			}}
			onMouseEnter={() => (hoveredCollapsePostUri.value = post.uri)}
			onMouseLeave={() => (hoveredCollapsePostUri.value = null)}
			className={`font-mono ${
				isHoveringThisPost.value
					? "text-slate-950 dark:text-slate-50"
					: "text-gray-500"
			}`}
		>
			<span className="flex items-center gap-0.5 text-xs">
				{isExpanded.value ? "[-]" : `[+${displayedReplyCount.value}]`}
			</span>
		</button>
	);
}
