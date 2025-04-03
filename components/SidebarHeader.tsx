import { SettingsToggle } from "@/components/SettingsToggle";
import { mode, searchSort, searchAuthor, cacheTimeAgo, contentSourceUrl } from "@/lib/signals";
import { autoFetchEnabled } from "@/lib/settings";
import { currentDomain, isWhitelisted } from "@/lib/messaging";
import { useSignal } from "@preact/signals";
import { getTimeAgo } from "@/lib/utils/time";
import { fetchPosts } from "@/lib/posts";

export function SidebarHeader() {
	const showFilters = useSignal(false);
	const authorInput = useSignal(searchAuthor.value || '');

	const handleSortChange = (e: Event) => {
		searchSort.value = (e.target as HTMLSelectElement).value as 'top' | 'latest';
	};

	const handleAuthorBlur = () => {
		searchAuthor.value = authorInput.value || null;
	};

	const handleRefresh = () => {
		if (contentSourceUrl.value) {
			fetchPosts(contentSourceUrl.value);
		}
	};

	return (
		<div class="sticky top-0 z-10 p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
			<div class="flex items-center justify-between gap-1">
				<div class="min-w-0 flex-1">
					<div class="flex flex-col items-start p-1">
						<div class="flex items-center gap-2">
							<button 
								class="text-base font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300"
							>
								bsky posts
							</button>
							<button
								onClick={() => showFilters.value = !showFilters.value}
								class="p-1 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
								aria-label="Toggle filters"
							>
								<Icon name="funnel" className="h-4 w-4" />
							</button>
						</div>
						{autoFetchEnabled.value ? (
							isWhitelisted.value ? (
								<div class="flex items-center text-[10px] mt-0.5 gap-1">
									<button
										onClick={handleRefresh}
										aria-label="Refresh posts"
										title="Refresh posts"
									><span class="flex items-center gap-0.5 text-green-600 dark:text-green-400 whitespace-nowrap cursor-pointer">
										<Icon name="arrowPath" className="h-2.5 w-2.5" />
										Auto
									</span>
									</button>
									<span class="text-gray-600 dark:text-gray-400 truncate">
										{currentDomain.value}
									</span>
									{cacheTimeAgo.value && (
										<span class="text-gray-500 dark:text-gray-500 truncate">
											{getTimeAgo(cacheTimeAgo.value)}
										</span>
									)}
								</div>
							) : (
								<div class="flex items-center text-[10px] mt-0.5">
									<span class="text-gray-600 dark:text-gray-400">
										Not whitelisted
									</span>
								</div>
							)
						) : (
							<div class="flex items-center text-[10px] mt-0.5">
								<span class="text-gray-600 dark:text-gray-400">
									Manual mode
								</span>
							</div>
						)}
					</div>
				</div>
				<div class="flex items-center gap-1 flex-shrink-0">
					<button
						onClick={() => mode.value = mode.value === 'full' ? 'compact' : 'full'}
						class="p-1 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700"
						aria-label="Toggle view mode"
					>
						{mode.value === 'full' ? (
							<Icon name="rectangleStack" className="h-4 w-4" />
						) : (
							<Icon name="queueList" className="h-4 w-4" />
						)}
					</button>
					<SettingsToggle />
				</div>
			</div>

			{/* Search Filters */}
			{showFilters.value && (
				<div class="mt-2 p-2 space-y-2 text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg">
					<div class="flex gap-2">
						<select
							value={searchSort.value}
							onChange={handleSortChange}
							class="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-sm"
						>
							<option value="latest">Latest</option>
							<option value="top">Top</option>
						</select>
					</div>
					<div class="flex items-center gap-2">
						<input
							type="text"
							placeholder="Filter by author (press Enter)"
							value={authorInput.value}
							onChange={(e) => authorInput.value = e.currentTarget.value}
							onBlur={handleAuthorBlur}
							onKeyDown={(e) => e.key === 'Enter' && handleAuthorBlur()}
							class="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-sm"
						/>
						{searchAuthor.value && (
							<button	
								onClick={() => {
									searchAuthor.value = null;
									authorInput.value = '';
								}}
								class="p-1 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
							>
								<Icon name="xMark" className="h-3 w-3" />
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
