import type { Signal } from "@preact/signals-core";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { useComputed } from "@preact/signals-react";
import { Icon } from "@/src/components/Icon";
import { hoveredCollapsePostUri } from "@/src/lib/signals";

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
			className={
				isExpanded.value
					? "absolute left-1 top-6.5 bottom-1 w-max flex flex-col items-center cursor-pointer z-10"
					: "cursor-pointer"
			}
			onMouseEnter={() => (hoveredCollapsePostUri.value = post.uri)}
			onMouseLeave={() => (hoveredCollapsePostUri.value = null)}
			onClick={(e) => {
				e.stopPropagation();
				isExpanded.value = !isExpanded.value;
			}}
			title={isExpanded.value ? "Collapse thread" : "Expand thread"}
		>
			{isExpanded.value ? (
				<div
					className={`w-[1.5px] h-1 transition-colors duration-150 ${
						isHoveringThisPost.value
							? "bg-slate-800 dark:bg-slate-50"
							: "bg-gray-200 dark:bg-gray-700"
					}`}
				/>
			) : null}
			<span className="font-mono flex items-center text-[10px]">
				{isExpanded.value ? (
					<Icon
						name="minusCircle"
						className={isExpanded.value ? "size-4" : "size-6"}
					/>
				) : (
					<Icon
						name="plusCircle"
						className={isExpanded.value ? "size-4" : "size-6"}
					/>
				)}
			</span>
			<div
				className={`w-[1.5px] flex-grow transition-colors duration-150 ${
					isHoveringThisPost.value
						? "bg-slate-800 dark:bg-slate-50"
						: "bg-gray-200 dark:bg-gray-700"
				}`}
			/>
		</div>
	);
}
