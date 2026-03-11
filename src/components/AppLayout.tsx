import { useEffect, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { signal } from "@preact/signals";
import { useQueryClient } from "@tanstack/react-query";
import { LoginButton } from "@/src/components/LoginButton";
import { quotedSelection, currentUrl } from "@/src/lib/messaging";
import { showQuotePopupOnSelection } from "@/src/lib/settings";
import SelectionPopupManagerV2 from "@/extension/entrypoints/popup.content/SelectionPopupManagerV2";
import { searchAndSaveArenaChannels, showArenaToast } from "@/src/lib/arena/arenaSearch";
import { arenaQueryKeys } from "@/src/lib/arena-api";
import { contentStateSignal, contentModeSignal } from "@/henry-ink/signals";
import type { AppBskyFeedDefs } from "@atcute/bluesky";

// UI state signals
const sidebarWidth = signal(384);
const isResizing = signal(false);
const isMobileSidebarOpen = signal(false);

interface AppLayoutProps {
	children: ComponentChildren;
	sidebar: ComponentChildren;
}

// Handle sidebar resize
const handleMouseDown = (e: MouseEvent) => {
	e.preventDefault();
	isResizing.value = true;

	const startX = e.clientX;
	const startWidth = sidebarWidth.value;

	const handleMouseMove = (e: MouseEvent) => {
		const delta = startX - e.clientX;
		const newWidth = Math.min(600, Math.max(384, startWidth + delta));
		sidebarWidth.value = newWidth;
	};

	const handleMouseUp = () => {
		isResizing.value = false;
		localStorage.setItem("sidebar-width", sidebarWidth.value.toString());
		document.removeEventListener("mousemove", handleMouseMove);
		document.removeEventListener("mouseup", handleMouseUp);
	};

	document.addEventListener("mousemove", handleMouseMove);
	document.addEventListener("mouseup", handleMouseUp);
};

export function AppLayout({ children, sidebar }: AppLayoutProps) {
	const mockContainerRef = useRef<HTMLDivElement>(null);
	const queryClient = useQueryClient();

	// Hide header on main page (when no URL is set)
	const showHeader = currentUrl.value && currentUrl.value.trim() !== '';

	// Get cached post count for FAB badge
	const cachedPosts = currentUrl.value
		? queryClient.getQueryData<AppBskyFeedDefs.PostView[]>(["posts", currentUrl.value])
		: undefined;
	const postCount = cachedPosts?.length ?? 0;

	// Load saved sidebar width from localStorage
	useEffect(() => {
		const saved = localStorage.getItem("sidebar-width");
		if (saved) {
			const width = parseInt(saved, 10);
			if (width >= 384 && width <= 600) {
				sidebarWidth.value = width;
			}
		}
	}, []);

	return (
		<div class="flex h-screen text-gray-900 dark:text-gray-100 overflow-hidden">
			{/* Main Content Area */}
			<main
				ref={mockContainerRef}
				class="flex-1 flex flex-col overflow-auto min-w-0"
			>
				{/* Header - only show when viewing articles */}
				{showHeader && (
					<header class="px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
						<div class="flex items-center gap-3 w-full">
							<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">
								<a
									href="https://henry.ink"
									class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
								>
									Henry's Note
								</a>
							</h1>

							{/* Content mode toolbar */}
							{contentStateSignal.value.type === "success" && contentModeSignal.value !== "embed" && (
								<div class="flex gap-1 items-center min-w-0">
									<button
										onClick={() => (contentModeSignal.value = "md")}
										class={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors flex-shrink-0 ${
											contentModeSignal.value === "md"
												? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
												: "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
										}`}
										title="Markdown reader mode"
									>
										<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
											<path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
										</svg>
										reader
									</button>

									<button
										onClick={() => (contentModeSignal.value = "archive")}
										class={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors flex-shrink-0 ${
											contentModeSignal.value === "archive"
												? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
												: "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
										}`}
										title="Archived page with original styling"
									>
										<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
										</svg>
										archive
									</button>

									<div class="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-0.5 flex-shrink-0" />

									<a
										href={`https://web.archive.org/web/${currentUrl.value}`}
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors flex-shrink-0"
										title="View on Wayback Machine"
									>
										<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
										</svg>
										<span class="hidden sm:inline">wayback</span>
									</a>

									<a
										href={`https://arena.henryzoo.com/${currentUrl.value}`}
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors flex-shrink-0"
										title="Search on Arena"
									>
										<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
										</svg>
										<span class="hidden sm:inline">arena</span>
									</a>

									<a
										href={currentUrl.value}
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors flex-shrink-0"
										title="View original page"
									>
										<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
										</svg>
										<span class="hidden sm:inline">original</span>
									</a>
								</div>
							)}

							<div class="flex-shrink-0 ml-auto">
								<LoginButton />
							</div>
						</div>
					</header>
				)}

				{/* Main Content */}
				<div class="flex-1 flex flex-col overflow-auto">
					<div class="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-6 flex-1 flex flex-col w-full min-w-0">
						{children}
					</div>
				</div>
			</main>

			{/* Desktop Sidebar */}
			<>
				{/* Resize Handle */}
				<div
					class={`hidden lg:block w-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 cursor-col-resize transition-colors ${isResizing.value ? "bg-blue-500" : ""}`}
					onMouseDown={handleMouseDown}
				></div>

				{/* Resizable Sidebar */}
				<aside
					class="hidden lg:flex flex-col border-l border-gray-200 dark:border-gray-700"
					style={{ width: `${sidebarWidth.value}px` }}
				>
					{sidebar}
				</aside>
			</>

			{/* Mobile Floating Action Button */}
			<div class="lg:hidden fixed bottom-6 right-6 z-50">
				<button
					class={`relative w-14 h-14 text-white rounded-full shadow-lg flex items-center justify-center transition-all transform active:scale-95 ${
						isMobileSidebarOpen.value
							? "bg-gray-600 hover:bg-gray-700 active:bg-gray-800"
							: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
					}`}
					onClick={() =>
						(isMobileSidebarOpen.value = !isMobileSidebarOpen.value)
					}
					aria-label={
						isMobileSidebarOpen.value ? "Close comments" : `Open comments${postCount > 0 ? ` (${postCount})` : ""}`
					}
				>
					{isMobileSidebarOpen.value ? (
						<svg
							class="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					) : (
						<svg
							class="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
							/>
						</svg>
					)}

					{/* Post count badge */}
					{postCount > 0 && !isMobileSidebarOpen.value && (
						<span class="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
							{postCount > 99 ? "99+" : postCount}
						</span>
					)}
				</button>
			</div>

			{/* Mobile Sidebar Overlay */}
			<div
				class={`lg:hidden fixed inset-0 z-40 transform transition-transform duration-300 ease-in-out ${isMobileSidebarOpen.value ? "translate-x-0" : "translate-x-full"}`}
			>
				<div class="flex h-full">
					{/* Backdrop */}
					<div
						class="flex-1 bg-black/50 backdrop-blur-sm transition-opacity"
						onClick={() => (isMobileSidebarOpen.value = false)}
					></div>

					{/* Mobile Sidebar Content - Wider on mobile */}
					<div class="w-full max-w-sm sm:max-w-md flex flex-col border-l border-gray-200 dark:border-gray-700 shadow-xl">
						{sidebar}
					</div>
				</div>
			</div>

			{/* Single SelectionPopupManagerV2 for the entire app */}
			<SelectionPopupManagerV2
				canShowPopup={() => showQuotePopupOnSelection.peek()}
				actions={[
					{
						title: "Quote",
						shortcut: "q",
						onClick: () => {
							const selection = window.getSelection()?.toString();
							if (!selection) return;
							quotedSelection.value = selection;
						},
						icon: "💬"
					},
					{
						title: "Arena",
						shortcut: "a",
						onClick: async () => {
							const selection = window.getSelection()?.toString();
							if (!selection) return;
							const result = await searchAndSaveArenaChannels(selection);
							showArenaToast(result, selection);

							// Invalidate Arena matches query to show new channels immediately
							if (result.success && result.channelCount > 0) {
								queryClient.invalidateQueries({
									queryKey: arenaQueryKeys.matches(currentUrl.value || null)
								});
							}
						},
						icon: "🔍"
					}
				]}
				targetContainerRef={mockContainerRef}
			/>
		</div>
	);
}

// Sidebar component exports for composition
export const SidebarHeader = ({
	title,
	onRefresh,
	showRefresh = false,
	refreshTitle,
	cacheTimeAgo
}: {
	title: string;
	onRefresh?: () => void;
	showRefresh?: boolean;
	refreshTitle?: string;
	cacheTimeAgo?: string;
}) => {
	return (
		<div class="flex-shrink-0 px-4 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
			{showRefresh && onRefresh ? (
				<button
					onClick={onRefresh}
					class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer flex flex-col items-start group"
					aria-label={refreshTitle || "Refresh"}
					title={refreshTitle || "Refresh"}
				>
					<div class="flex items-center gap-1.5">
						<span>{title}</span>
						<svg
							class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
					</div>
					{cacheTimeAgo && (
						<span
							class="text-xs text-gray-400 dark:text-gray-500 normal-case tracking-normal font-normal"
							title="These discussions were saved to show you results faster. Click to refresh and get the latest posts."
						>
							{cacheTimeAgo}
						</span>
					)}
				</button>
			) : (
				<div class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
					{title}
				</div>
			)}
			{/* Close button - only shows on mobile when sidebar is open */}
			{isMobileSidebarOpen.value && (
				<button
					class="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					onClick={() => (isMobileSidebarOpen.value = false)}
					aria-label="Close sidebar"
				>
					<svg
						class="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			)}
		</div>
	);
};

export const SidebarContent = ({ children }: { children: ComponentChildren }) => {
	return (
		<div class="flex-1 overflow-hidden">
			{children}
		</div>
	);
};
