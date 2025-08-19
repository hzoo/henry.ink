import { useEffect, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { signal } from "@preact/signals";
import { useQueryClient } from "@tanstack/react-query";
import { LoginButton } from "@/src/components/LoginButton";
import { quotedSelection, currentUrl } from "@/src/lib/messaging";
import { showQuotePopupOnSelection } from "@/src/lib/settings";
import SelectionPopupManagerV2 from "@/entrypoints/popup.content/SelectionPopupManagerV2";
import { searchAndSaveArenaChannels, showArenaToast } from "@/src/lib/arena/arenaSearch";
import { arenaQueryKeys } from "@/src/lib/arena-api";

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
					<header class="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
						<div class="max-w-4xl mx-auto flex justify-between items-center w-full">
							<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
								<a
									href="https://henry.ink"
									class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
								>
									Henry's Note
								</a>
							</h1>
							<div class="flex-shrink-0">
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
					class={`hidden lg:block w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 cursor-col-resize transition-colors ${isResizing.value ? "bg-blue-500" : ""}`}
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
					class={`w-14 h-14 text-white rounded-full shadow-lg flex items-center justify-center transition-all transform active:scale-95 ${
						isMobileSidebarOpen.value
							? "bg-gray-600 hover:bg-gray-700 active:bg-gray-800"
							: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
					}`}
					onClick={() =>
						(isMobileSidebarOpen.value = !isMobileSidebarOpen.value)
					}
					aria-label={
						isMobileSidebarOpen.value ? "Close comments" : "Open comments"
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