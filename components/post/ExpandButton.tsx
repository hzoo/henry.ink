import type { Signal } from "@preact/signals-core";
import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import { useComputed } from "@preact/signals-react";

import { hoveredCollapsePostUri } from "@/lib/signals";

interface ExpandButtonProps {
	post: AppBskyFeedDefs.PostView;
	isExpanded: Signal<boolean>;
}

export function ExpandButton({ post, isExpanded }: ExpandButtonProps) {
	const isHoveringThisPost = useComputed(
		() => hoveredCollapsePostUri.value === post.uri,
	);

	return (
		<div
			className="absolute left-0 top-1 bottom-1 w-max flex flex-col items-center cursor-pointer"
			onMouseEnter={() => (hoveredCollapsePostUri.value = post.uri)}
			onMouseLeave={() => (hoveredCollapsePostUri.value = null)}
			onClick={(e) => {
				e.stopPropagation();
				isExpanded.value = !isExpanded.value;
			}}
			title={isExpanded.value ? "Collapse thread" : "Expand thread"}
		>
			<div
				className={`w-[2px] h-0 transition-colors duration-150 ${
					isHoveringThisPost.value
						? "bg-slate-800 dark:bg-slate-50"
						: "bg-gray-200 dark:bg-gray-700"
				}`}
			/>
			<span className="font-mono flex items-center gap-0.5 text-[10px]">
				[{isExpanded.value ? "-" : "+"}]
			</span>
			<div
				className={`w-[2px] flex-grow transition-colors duration-150 ${
					isHoveringThisPost.value
						? "bg-slate-800 dark:bg-slate-50"
						: "bg-gray-200 dark:bg-gray-700"
				}`}
			/>
		</div>
	);
}
