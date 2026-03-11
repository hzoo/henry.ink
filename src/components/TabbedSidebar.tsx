import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/src/components/Sidebar";
import { ArenaSidebar } from "@/src/components/ArenaSidebar";
import { cacheTimeAgo } from "@/src/lib/signals";
import { getTimeAgo } from "@/src/lib/utils/time";
import { queryClient } from "@/src/lib/queryClient";
import { currentUrl } from "@/src/lib/messaging";
import { useAtCute } from "@/demo/lib/oauth";
import { FirstTimePopup } from "@/src/components/FirstTimePopup";
import { QuotePopup } from "@/src/components/QuotePopup";
import { contentStateSignal, activeTabSignal, arenaViewModeSignal } from "@/henry-ink/signals";
import { fetchArenaMatches, arenaQueryKeys } from "@/src/lib/arena-api";
import type { ArenaMatch } from "@/src/lib/arena-types";

interface TabbedSidebarProps {
	hidePopup?: boolean;
	autoAllowDomain?: string;
}

export function TabbedSidebar({ hidePopup = false, autoAllowDomain }: TabbedSidebarProps) {
	useAtCute();

	const contentState = contentStateSignal.value;

	// Access arena matches data from React Query cache
	const { data: arenaMatches = [] } = useQuery<ArenaMatch[]>({
		queryKey: arenaQueryKeys.matches(currentUrl.value || null),
		queryFn: () => fetchArenaMatches(contentState.type === 'success' ? contentState.content : ''),
		enabled: false, // Don't fetch here, just access cached data
	});

	const handleRefresh = () => {
		if (currentUrl.value) {
			queryClient.refetchQueries({ queryKey: ["posts", currentUrl.value] });
		}
	};

	const handleArenaRefresh = () => {
		queryClient.invalidateQueries({
			predicate: (query) => query.queryKey[0] === 'arenaMatches'
		});
	};

	return (
		<div className="flex flex-col h-full relative lg:bg-transparent bg-gray-50 dark:bg-gray-950">
			{/* Tab Navigation with inline controls */}
			<div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
				<div className="flex items-stretch">
					<button
						onClick={() => (activeTabSignal.value = 'bluesky')}
						className={`flex-1 px-4 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
							activeTabSignal.value === 'bluesky'
								? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
						}`}
					>
						Bluesky
					</button>
					<button
						onClick={() => (activeTabSignal.value = 'arena')}
						className={`flex-1 px-4 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
							activeTabSignal.value === 'arena'
								? 'border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
						}`}
					>
						Arena
						{arenaMatches.length > 0 && (
							<span className="ml-1.5 text-xs opacity-60">{arenaMatches.length}</span>
						)}
					</button>

					{/* Inline controls */}
					<div className="flex items-center px-2 gap-1 border-b-2 border-transparent">
						{activeTabSignal.value === 'bluesky' ? (
							<button
								onClick={handleRefresh}
								className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
								title={cacheTimeAgo.value ? `Cached ${getTimeAgo(cacheTimeAgo.value)} — click to refresh` : "Refresh Bluesky discussions"}
							>
								<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
							</button>
						) : (
							<>
								<button
									onClick={() => arenaViewModeSignal.value = arenaViewModeSignal.value === 'preview' ? 'compact' : 'preview'}
									className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
									title={arenaViewModeSignal.value === 'preview' ? 'Switch to compact view' : 'Switch to preview mode'}
								>
									{arenaViewModeSignal.value === 'preview' ? (
										<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
										</svg>
									) : (
										<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
										</svg>
									)}
								</button>
								<button
									onClick={handleArenaRefresh}
									className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
									title="Refresh Arena channels"
								>
									<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
								</button>
							</>
						)}
					</div>
				</div>
			</div>

			{/* Tab Content */}
			{activeTabSignal.value === 'bluesky' && (
				<div className="flex-1 overflow-hidden">
					<Sidebar
						hidePopup={true}
						autoAllowDomain={autoAllowDomain}
					/>
				</div>
			)}

			{activeTabSignal.value === 'arena' && <ArenaSidebar />}

			{!hidePopup && <FirstTimePopup />}
			<QuotePopup />
		</div>
	);
}
