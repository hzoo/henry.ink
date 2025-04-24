import type { Signal } from "@preact/signals-core";
import { getThreadSignal } from "@/lib/signals";
import { useComputed } from "@preact/signals-react";
import type { AppBskyFeedDefs } from "@atcute/client/lexicons";

export function ExpandButton({ post, isExpanded }: { post: AppBskyFeedDefs.PostView, isExpanded: Signal<boolean> }) {
	const threadSignal = getThreadSignal(post.uri);
	const displayedReplyCount = useComputed(() => {
		const signalData = threadSignal.value.data;
		return Array.isArray(signalData) ? signalData.length : post.replyCount ?? 0;
	  });

	  
	return (<button
		onClick={(e) => {
			e.stopPropagation();
			isExpanded.value = !isExpanded.value;
		}}
		className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-mono"
	>
		<span className="flex items-center gap-0.5 text-xs">
			{isExpanded.value ? "[-]" : `[+${displayedReplyCount.value}]`}
		</span>
	</button>)
}
