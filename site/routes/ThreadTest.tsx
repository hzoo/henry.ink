import { useSignal, useComputed } from "@preact/signals-react/runtime";
import { FullPost } from "@/components/post/FullPost";
import type { DisplayableItem } from "@/components/post/FullPost";
import { Icon } from "@/components/Icon";
import { FileView } from "@/components/experimental/FileView";
import { getAtUriFromUrl } from "@/lib/utils/postUrls";
import { fetchProcessedThread, type Thread } from "@/lib/threadUtils";
import { ThreadNavigator } from "@/lib/threadNavigation";
import { useQuery } from "@tanstack/react-query";
import { ChatView } from "@/components/experimental/ChatView";
import { CardStack } from "@/components/experimental/CardStack";
import { SlideshowView } from "@/components/experimental/SlideshowView";

export const VIEW_MODES = [
	"thread",
	"file",
	"chat",
	"stack",
	"slideshow",
] as const;

export type ViewMode = (typeof VIEW_MODES)[number];

// ThreadView component to handle different rendering modes
function ThreadView({
	threadData,
	navigator,
	viewMode,
	displayItems,
	atUri,
}: {
	threadData: Thread | undefined;
	navigator: ThreadNavigator | null;
	viewMode: ViewMode;
	displayItems: DisplayableItem[];
	atUri: string;
}) {
	// Return early if we don't have a valid URI for some modes or no data
	if (!atUri && viewMode === "thread") return null;
	if (!threadData && viewMode === "thread") return null;
	if (!navigator && (viewMode === "file" || viewMode === "chat" || viewMode === "slideshow" || viewMode === "stack"))
		return null;

	// Component mapping for each view mode
	const viewComponents: Record<ViewMode, React.ReactNode> = {
		thread: <FullPost uri={atUri} displayItems={displayItems} />,
		file: navigator && (
			<FileView navigator={navigator} displayItems={displayItems} />
		),
		chat: navigator && (
			<ChatView navigator={navigator} displayItems={displayItems} />
		),
		stack: navigator && (
			<CardStack navigator={navigator} displayItems={displayItems} />
		),
		slideshow: navigator && (
			<SlideshowView navigator={navigator} displayItems={displayItems} />
		),
	};

	// Return the component for the current mode
	return <>{viewComponents[viewMode]}</>;
}

export interface ThreadTestProps {
	path: string;
	user?: string;
	post?: string;
}

function initThreadUri(props: ThreadTestProps) {
	const { user, post } = props;
	if (user && post) {
		return `at://${user}/app.bsky.feed.post/${post}`;
	} else if (user) {
		return `at://${user}`;
	}

	return "https://bsky.app/profile/henryzoo.com/post/3lltzjrnjnc2b";
}

const BookmarkletButton = () => {
	const bookmarkletHref =
		"javascript:(function(){var url = window.location.href; if (url.startsWith('https://bsky.app/')) { var newUrl = url.replace('https://bsky.app', 'https://annotation-demo.henryzoo.com'); window.location.href = newUrl; } else { alert('Not a bsky.app URL. Please navigate to a bsky.app page.'); }})();";

	const handleClick = (event: MouseEvent) => {
		event.preventDefault();
		alert(
			"Drag this button to your browser's bookmarks bar to use the 'annotate bsky' bookmarklet.",
		);
	};

	return (
		<a
			href={bookmarkletHref}
			onClick={handleClick}
			title="Drag this to your bookmarks bar to quickly annotate bsky.app pages"
			className="px-3 py-1 text-xs bg-sky-100 hover:bg-sky-200 dark:bg-sky-700 dark:hover:bg-sky-600 text-sky-800 dark:text-sky-200 rounded-sm border border-sky-300 dark:border-sky-600 whitespace-nowrap no-underline cursor-grab"
		>
			→ bookmarklet
		</a>
	);
};

export function ThreadTest(props: ThreadTestProps) {
	const threadUri = useSignal(initThreadUri(props));
	const displayItems = useSignal<DisplayableItem[]>([
		"avatar",
		"displayName",
		"handle",
	]);
	const viewMode = useSignal<ViewMode>("chat");
	const showDisplayToggle = useSignal(false);

	// Computed values
	const atUri = useComputed(() => {
		if (threadUri.value.startsWith("https://")) {
			return getAtUriFromUrl(threadUri.value);
		}
		return threadUri.value;
	});

	const contentMaxWidthClass = useComputed(() => {
		return viewMode.value === "slideshow" ? "max-w-[1280px]" : "max-w-[600px]";
	});

	// Helper function for toggling display items
	const toggleDisplayItem = (item: DisplayableItem) => {
		const currentItems = displayItems.value;
		if (currentItems.includes(item)) {
			displayItems.value = currentItems.filter((i) => i !== item);
		} else {
			displayItems.value = [...currentItems, item];
		}
	};

	const {
		data: threadData,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["thread", atUri.value],
		queryFn: () => fetchProcessedThread(atUri.value),
		staleTime: 1000 * 60 * 60 * 24,
		enabled: !!atUri.value, // Only run query if atUri is set
	});

	// Compute the navigator based on thread data
	const threadNavigator = useComputed(() => {
		if (!threadData) return null;
		console.log('new navigator');
		// Initialize with the atUri if it exists in the thread, otherwise use root
		const initialUri = atUri.value && threadData.post.uri === atUri.value ? atUri.value : undefined;
		return new ThreadNavigator(threadData, initialUri);
	});

	// Display toggle component
	const DisplayToggle = () => {
		if (!showDisplayToggle.value) {
			return null;
		}
		return (
			<div className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-sm shadow-lg z-10 transition-opacity duration-200">
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
	};

	return (
		<div className="min-h-screen">
			{/* Sticky Header */}
			<div className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
				<div className="p-2">
					<div className="max-w-[720px] mx-auto space-y-2">
						{!props.user && (
							<div className="flex items-center gap-1 relative">
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
									<div
										className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
										onClick={() =>
											(showDisplayToggle.value = !showDisplayToggle.value)
										}
									>
										<Icon name="cog" className="size-4" />
									</div>
								</div>
								<DisplayToggle />
							</div>
						)}
						<div className="flex items-center gap-3">
							<span className="text-xs font-medium text-gray-700 dark:text-gray-300">
								Mode:
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
							<BookmarkletButton />
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className={`mx-auto pt-2 ${contentMaxWidthClass.value}`}>
				{isLoading ? (
					<div className="p-4">Loading conversation...</div>
				) : error ? (
					<div className="p-4 text-center text-red-500">
						Error loading thread:{" "}
						{error instanceof Error ? error.message : "Unknown error"}
					</div>
				) : (
					<ThreadView
						threadData={threadData}
						navigator={threadNavigator.value}
						viewMode={viewMode.value}
						displayItems={displayItems.value}
						atUri={atUri.value}
					/>
				)}
			</div>
		</div>
	);
}
