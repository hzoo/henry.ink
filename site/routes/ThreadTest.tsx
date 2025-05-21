import { batch, computed, signal } from "@preact/signals";
import { FullPost } from "@/components/post/FullPost";
import { ContinuousPost } from "@/components/experimental/ContinuousPost";
import type { DisplayableItem } from "@/components/post/FullPost";
import { Icon } from "@/components/Icon";
import { FSPost } from "@/components/experimental/FSPost";
import { getAtUriFromUrl } from "@/lib/utils/postUrls";
import { fetchProcessedThread, type Thread } from "@/lib/threadUtils";
import { useQuery } from "@tanstack/react-query";
import { ChatView } from "@/components/experimental/ChatView";
import { CardStack } from "@/components/experimental/CardStack";

export const VIEW_MODES = [
	"nested",
	"continuous",
	"fs",
	"messenger",
	"stack",
] as const;

export type ViewMode = (typeof VIEW_MODES)[number];

const threadUri = signal(
	"https://bsky.app/profile/henryzoo.com/post/3lltzjrnjnc2b",
);
const displayItems = signal<DisplayableItem[]>([
	"avatar",
	"displayName",
	"handle",
]);
const viewMode = signal<ViewMode>("messenger");
const atUri = computed(() => {
	if (threadUri.value.startsWith("https://")) {
		return getAtUriFromUrl(threadUri.value);
	}
	return threadUri.value;
});

const toggleDisplayItem = (item: DisplayableItem) => {
	batch(() => {
		const currentItems = displayItems.value;
		if (currentItems.includes(item)) {
			displayItems.value = currentItems.filter((i) => i !== item);
		} else {
			displayItems.value = [...currentItems, item];
		}
	});
};

function DisplayToggle() {
	return (
		<div className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-sm shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
			<div className="p-2">
				<div className="flex items-center pb-1">
					<div className="flex flex-col min-w-0 w-full">
						<div className="flex items-center gap-1">
							<div className="relative hover:bg-amber-200 dark:hover:bg-amber-700/50 rounded-full">
								<img
									src={
										displayItems.value.includes("avatar")
											? "https://cdn.bsky.app/img/avatar/plain/did:plc:3wng2qnttvtg23546ar6bawo/bafkreiep2suix67jfwu5uw23zxiyleesjkfdbynuitdbtowwwm3r2xsmha@jpeg"
											: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32' fill='none'%3E%3Crect width='32' height='32' rx='16' fill='%23E5E7EB'/%3E%3C/svg%3E"
									}
									alt="Avatar"
									className="w-8 h-8 rounded-full flex-shrink-0 cursor-pointer transition-opacity hover:opacity-70"
									onClick={() => toggleDisplayItem("avatar")}
								/>
							</div>
							<div className="flex flex-col">
								<div className="flex items-center gap-0.5">
									<div
										className={`${displayItems.value.includes("displayName") ? "font-semibold text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"} cursor-pointer hover:opacity-70 hover:bg-amber-200 dark:hover:bg-amber-700/50 transition-opacity text-xs rounded-sm px-0.5`}
										onClick={() => toggleDisplayItem("displayName")}
									>
										henry
									</div>
									<div
										className={`${displayItems.value.includes("handle") ? "text-gray-500 dark:text-gray-400" : "text-gray-300 dark:text-gray-600"} cursor-pointer hover:opacity-70 hover:bg-amber-200 dark:hover:bg-amber-700/50 transition-opacity text-xs rounded-sm px-0.5`}
										onClick={() => toggleDisplayItem("handle")}
									>
										@henryzoo.com
									</div>
									<span className="text-gray-400 text-xs">·</span>
									<span className="text-gray-500 text-xs">10m</span>
								</div>
								<div className="text-gray-800 dark:text-gray-200 mt-0.5 text-xs">
									Click each element to toggle visibility.
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// Thread view component to handle different rendering modes
function ThreadView({
	threadData,
}: {
	threadData: Thread | undefined;
}) {
	const mode = viewMode.value;
	const uri = atUri.value;
	const items = displayItems.value;

	// Return early if we don't have a valid URI
	if (!uri) return null;

	// Component mapping for each view mode
	const viewComponents: Record<ViewMode, React.ReactNode> = {
		nested: <FullPost uri={uri} displayItems={items} />,
		continuous: threadData && (
			<ContinuousPost threadData={threadData} displayItems={items} />
		),
		fs: threadData && <FSPost threadData={threadData} displayItems={items} />,
		messenger: threadData && (
			<ChatView threadData={threadData} displayItems={items} />
		),
		stack: threadData && (
			<CardStack threadData={threadData} displayItems={items} />
		),
	};

	// Return the component for the current mode
	return <>{viewComponents[mode]}</>;
}

export function ThreadTest() {
	const {
		data: threadData,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["thread", atUri.value],
		queryFn: () => fetchProcessedThread(atUri.value),
		staleTime: 1000 * 60 * 60 * 24,
	});

	return (
		<div className="p-2">
			<div className="max-w-[720px] mx-auto space-y-2">
				<div>
					<div className="flex items-center gap-1 relative group">
						<input
							type="text"
							id="threadUri"
							value={threadUri.value}
							onInput={(e) => {
								threadUri.value = e.currentTarget.value;
							}}
							placeholder="e.g., at://did:plc:example/app.bsky.feed.post/abcdefghijk"
							className="flex-grow px-2 py-1 border border-gray-300 rounded-sm shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
						/>
						<div className="absolute inset-y-0 right-0 flex items-center pr-2">
							<div className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
								<Icon name="cog" className="size-4" />
							</div>
						</div>
						<DisplayToggle />
					</div>
				</div>
				<div className="flex items-center gap-3">
					<span className="text-xs font-medium text-gray-700 dark:text-gray-300">
						Thread Mode:
					</span>
					<div className="flex border border-gray-300 dark:border-gray-600 rounded-sm overflow-hidden">
						{VIEW_MODES.map((mode) => (
							<button
								key={mode}
								onClick={() => (viewMode.value = mode)}
								className={`px-3 py-1 text-xs ${
									viewMode.value === mode
										? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
										: "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300"
								}`}
							>
								{mode.charAt(0).toUpperCase() + mode.slice(1)}
							</button>
						))}
					</div>
				</div>
			</div>

			<div className="max-w-[600px] mx-auto pt-2">
				{isLoading ? (
					<div className="p-4">Loading conversation...</div>
				) : error ? (
					<div className="p-4 text-center text-red-500">
						Error loading thread:{" "}
						{error instanceof Error ? error.message : "Unknown error"}
					</div>
				) : (
					<ThreadView threadData={threadData} />
				)}
			</div>
		</div>
	);
}
