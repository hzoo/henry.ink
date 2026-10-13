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
import { MarginNotes } from "@/henry-ink/components/MarginNotes";
import { ReaderIcon } from "@/src/components/ReaderIcon";
import { ProviderLogo } from "@/src/components/ProviderLogo";

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
		<div className="flex flex-col h-full relative bg-white dark:bg-gray-900">
			{/* Tab Navigation with inline controls */}
			<div className="flex-shrink-0 px-2 py-1.5 border-b border-gray-100 dark:border-gray-800">
				<div className="flex items-center rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800" role="group" aria-label="Discussion source">
					<button onClick={() => activeTabSignal.value = 'notes'}
						aria-pressed={activeTabSignal.value === 'notes'}
						className={`flex flex-1 min-h-10 items-center justify-center gap-2 rounded-md px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-gray-500 ${activeTabSignal.value === 'notes' ? 'bg-white shadow-sm text-gray-950 dark:bg-gray-700 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white'}`}>
						<ReaderIcon name="highlight" /> Notes
					</button>
					<button
						onClick={() => (activeTabSignal.value = 'bluesky')}
						aria-pressed={activeTabSignal.value === 'bluesky'}
						className={`flex flex-1 min-h-10 items-center justify-center gap-2 rounded-md px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-gray-500 transition-colors ${
							activeTabSignal.value === 'bluesky'
								? 'bg-white shadow-sm text-gray-950 dark:bg-gray-700 dark:text-white'
								: 'text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white'
						}`}
					>
						<ProviderLogo provider="Bluesky" /> Bluesky
					</button>
					<button
						onClick={() => (activeTabSignal.value = 'arena')}
						aria-pressed={activeTabSignal.value === 'arena'}
						className={`flex flex-1 min-h-10 items-center justify-center gap-2 rounded-md px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-gray-500 transition-colors ${
							activeTabSignal.value === 'arena'
								? 'bg-white shadow-sm text-gray-950 dark:bg-gray-700 dark:text-white'
								: 'text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white'
						}`}
					>
						<ReaderIcon name="grid" /> Arena
						{arenaMatches.length > 0 && (
							<span className="text-[10px] tabular-nums opacity-60">{arenaMatches.length}</span>
						)}
					</button>

					{/* Inline controls */}
				</div>
					<div className="flex items-center justify-end empty:hidden">
						{activeTabSignal.value === 'bluesky' ? (
							<button
								onClick={handleRefresh}
								className="inline-flex min-h-10 min-w-10 items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg focus-visible:outline-2 focus-visible:outline-gray-500"
								title={cacheTimeAgo.value ? `Cached ${getTimeAgo(cacheTimeAgo.value)} — click to refresh` : "Refresh Bluesky discussions"}
							>
								<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
							</button>
						) : activeTabSignal.value === 'arena' ? (
							<>
								<button
									onClick={() => arenaViewModeSignal.value = arenaViewModeSignal.value === 'preview' ? 'compact' : 'preview'}
									className="inline-flex min-h-10 min-w-10 items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg focus-visible:outline-2 focus-visible:outline-gray-500"
									aria-pressed={arenaViewModeSignal.value === 'preview'}
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
									className="inline-flex min-h-10 min-w-10 items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg focus-visible:outline-2 focus-visible:outline-gray-500"
									title="Refresh Arena channels"
								>
									<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
								</button>
							</>
						) : null}
					</div>
			</div>

			{/* Tab Content */}
				<div className="flex-1 min-h-0 overflow-hidden" hidden={activeTabSignal.value !== 'bluesky'}>
					<Sidebar
						hidePopup={true}
						hideQuotePopup={true}
						autoAllowDomain={autoAllowDomain}
					/>
				</div>
			{activeTabSignal.value === 'notes' && <div class="flex-1 min-h-0 overflow-hidden"><MarginNotes /></div>}

			{activeTabSignal.value === 'arena' && <ArenaSidebar />}

			{!hidePopup && <FirstTimePopup />}
			<QuotePopup />
		</div>
	);
}
