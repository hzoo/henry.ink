import { useQuery } from "@tanstack/react-query";
import { useId, useRef } from "preact/hooks";
import { Sidebar } from "@/src/components/Sidebar";
import { ArenaSidebar } from "@/src/components/ArenaSidebar";
import { cacheTimeAgo } from "@/src/lib/signals";
import { getTimeAgo } from "@/src/lib/utils/time";
import { queryClient } from "@/src/lib/queryClient";
import { currentUrl, isSearchableUrl } from "@/src/lib/messaging";
import { FirstTimePopup } from "@/src/components/FirstTimePopup";
import { QuotePopup } from "@/src/components/QuotePopup";
import { contentStateSignal, activeTabSignal, arenaViewModeSignal, type TabType } from "@/henry-ink/signals";
import { fetchArenaMatches, arenaQueryKeys } from "@/src/lib/arena-api";
import type { ArenaMatch } from "@/src/lib/arena-types";
import { MarginNotes } from "@/henry-ink/components/MarginNotes";
import { ReaderIcon } from "@/src/components/ReaderIcon";
import { arenaUrlState } from "@/src/lib/arena-navigation";
import { atCuteState } from "@/demo/lib/oauth";

const sources: { id: TabType; label: string }[] = [
	{ id: "notes", label: "Notes" },
	{ id: "bluesky", label: "Bluesky" },
	{ id: "arena", label: "Arena" },
];

interface TabbedSidebarProps {
	hidePopup?: boolean;
	autoAllowDomain?: string;
}

export function TabbedSidebar({ hidePopup = false, autoAllowDomain }: TabbedSidebarProps) {
	const id = useId();
	const tabsRef = useRef<HTMLDivElement>(null);
	const activeTab = activeTabSignal.value;
	const channelSlug = arenaUrlState.value.channelSlug;

	const contentState = contentStateSignal.value;
	const url = currentUrl.value;

	// Access arena matches data from React Query cache
	const { data: arenaMatches = [] } = useQuery<ArenaMatch[]>({
		queryKey: arenaQueryKeys.matches(url || null),
		queryFn: ({ signal }) => fetchArenaMatches(contentState.type === 'success' ? contentState.content : '', url, signal),
		enabled: false, // Don't fetch here, just access cached data
	});

	const handleRefresh = () => {
		if (!isSearchableUrl.peek()) return;
		// An explicit refresh also runs when automatic lookup is disabled.
		const query = queryClient.getQueryCache().find({ queryKey: ["posts", currentUrl.peek(), atCuteState.peek()?.session.info.sub ?? null], exact: true });
		void query?.fetch().catch(() => {});
	};

	const handleArenaRefresh = () => {
		queryClient.invalidateQueries({
			queryKey: channelSlug ? arenaQueryKeys.blocks(channelSlug) : arenaQueryKeys.matches(currentUrl.value || null)
		});
	};

	return (
		<div className="flex flex-col h-full relative bg-white dark:bg-gray-900">
			<div className="flex-shrink-0 border-b border-gray-100 px-2 py-1.5 dark:border-gray-800">
				<div className="flex items-center gap-1">
					<div ref={tabsRef} role="tablist" aria-label="Discussion source" className="flex min-w-0 flex-1 items-center rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800"
						onKeyDown={event => {
							const index = sources.findIndex(source => source.id === activeTab);
							const next = event.key === 'ArrowRight' ? (index + 1) % sources.length
								: event.key === 'ArrowLeft' ? (index + sources.length - 1) % sources.length
								: event.key === 'Home' ? 0 : event.key === 'End' ? sources.length - 1 : null;
							if (next === null) return;
							event.preventDefault();
							activeTabSignal.value = sources[next].id;
							tabsRef.current?.querySelector<HTMLButtonElement>(`[data-source="${sources[next].id}"]`)?.focus();
						}}>
						{sources.map(source => <button key={source.id} type="button" role="tab"
							id={`${id}-${source.id}-tab`} data-source={source.id}
							aria-selected={activeTab === source.id} aria-controls={`${id}-${source.id}-panel`}
							tabIndex={activeTab === source.id ? 0 : -1}
							onClick={() => { activeTabSignal.value = source.id; }}
							className={`flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-gray-500 ${activeTab === source.id ? 'bg-white shadow-sm text-gray-950 dark:bg-gray-700 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white'}`}>
							{source.label}
							{source.id === 'arena' && arenaMatches.length > 0 && <span className="text-[10px] tabular-nums opacity-60">{arenaMatches.length}</span>}
						</button>)}
					</div>
					<div className="flex min-h-10 w-20 shrink-0 items-center justify-end">
						{activeTab === 'bluesky' && <button type="button" onClick={handleRefresh}
							className="reader-icon-button text-gray-500 hover:text-gray-900 dark:hover:text-white"
							aria-label="Refresh Bluesky discussions"
							title={cacheTimeAgo.value ? `Cached ${getTimeAgo(cacheTimeAgo.value)} — refresh discussions` : 'Refresh Bluesky discussions'}>
							<ReaderIcon name="refresh" />
						</button>}
						{activeTab === 'arena' && <>
							{!channelSlug && <button type="button" onClick={() => { arenaViewModeSignal.value = arenaViewModeSignal.value === 'preview' ? 'compact' : 'preview'; }}
								className="reader-icon-button text-gray-500 hover:text-gray-900 dark:hover:text-white"
								aria-label="Preview channel images" aria-pressed={arenaViewModeSignal.value === 'preview'}
								title={arenaViewModeSignal.value === 'preview' ? 'Use compact view' : 'Preview channel images'}>
								<ReaderIcon name={arenaViewModeSignal.value === 'preview' ? 'text' : 'grid'} />
							</button>}
							<button type="button" onClick={handleArenaRefresh}
								className="reader-icon-button text-gray-500 hover:text-gray-900 dark:hover:text-white"
								aria-label={channelSlug ? 'Refresh Arena channel' : 'Refresh Arena channels'} title={channelSlug ? 'Refresh Arena channel' : 'Refresh Arena channels'}><ReaderIcon name="refresh" /></button>
						</>}
					</div>
				</div>
			</div>

			{/* Tab Content */}
				<div id={`${id}-bluesky-panel`} role="tabpanel" aria-labelledby={`${id}-bluesky-tab`} className="flex-1 min-h-0 overflow-hidden" hidden={activeTab !== 'bluesky'}>
					<Sidebar
						hidePopup={true}
						hideQuotePopup={true}
						autoAllowDomain={autoAllowDomain}
					/>
				</div>
			<div id={`${id}-notes-panel`} role="tabpanel" aria-labelledby={`${id}-notes-tab`} class="flex-1 min-h-0 overflow-hidden" hidden={activeTab !== 'notes'}>{activeTab === 'notes' && <MarginNotes />}</div>

			<div id={`${id}-arena-panel`} role="tabpanel" aria-labelledby={`${id}-arena-tab`} class="flex-1 min-h-0 overflow-hidden" hidden={activeTab !== 'arena'}>{activeTab === 'arena' && <ArenaSidebar />}</div>

			{!hidePopup && <FirstTimePopup />}
			<QuotePopup />
		</div>
	);
}
