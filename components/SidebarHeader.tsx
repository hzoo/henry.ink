import { SettingsToggle } from "@/components/SettingsToggle";
import { cacheTimeAgo, contentSourceUrl } from "@/lib/signals";
import { autoFetchEnabled } from "@/lib/settings";
import { currentDomain, isWhitelisted } from "@/lib/messaging";
import { getTimeAgo } from "@/lib/utils/time";
import { fetchPosts } from "@/lib/posts";
import { Icon } from "@/components/Icon";
import { useAtCute } from "@/site/lib/oauth";

const handleRefresh = () => {
	if (contentSourceUrl.value) {
		fetchPosts(contentSourceUrl.value);
	}
};

export function SidebarHeader() {
	useAtCute();

	return (
		<div class="sticky top-0 z-10 p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
			<div class="flex items-center justify-between gap-1">
				<div class="min-w-0 flex-1">
					<div class="flex flex-col items-start p-1">
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
					<SettingsToggle />
				</div>
			</div>

		</div>
	);
}
