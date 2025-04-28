import { useSignalEffect } from "@preact/signals";
import { currentUrl, isWhitelisted, isSearchableUrl } from "@/lib/messaging";
import { LoadingItemList } from "@/components/LoadingItem";
import { ErrorMessage } from "@/components/ErrorMessage";
import { SidebarHeader } from "@/components/SidebarHeader";
import { EmptyList } from "@/components/EmptyList";
import { currentPosts, loading, error, contentSourceUrl, cacheTimeAgo, lastSeenVersion } from "@/lib/signals";
import { autoFetchEnabled } from "@/lib/settings";
import { PostList } from "@/components/PostList";
import { fetchPosts, loadFromCacheAndUpdate } from "@/lib/posts";
import { FirstTimePopup } from "@/components/FirstTimePopup";
import { QuotePopup } from "./QuotePopup";
import { quotedSelection } from "@/lib/messaging";

function SidebarBody() {
	// Load content when URL changes
	useSignalEffect(() => {
		const controller = new AbortController();
		const newUrl = currentUrl.value;
		
		if (newUrl && isSearchableUrl.value) {
			// Update content source URL
			contentSourceUrl.value = newUrl;
			
			// Only fetch if auto-fetch is enabled AND domain is whitelisted
			if (autoFetchEnabled.value && isWhitelisted.value) {
				// Try cache first, then update if needed
				loadFromCacheAndUpdate(newUrl, controller.signal).then(hadCache => {
					if (!hadCache) {
						// No cache, do a full fetch
						fetchPosts(newUrl, { signal: controller.signal });
					}
				});
			} else {
				currentPosts.value = [];
				cacheTimeAgo.value = null;
			}
		}

		// Cleanup function to abort any in-flight request when URL changes
		return () => {
			controller.abort('URL changed');
		};
	});

	return (
		<div className="flex-1 overflow-y-auto">
		{loading.value ? (
				<LoadingItemList />
			) : error.value ? (
				<ErrorMessage message={error.value} />
			) : <PostList />}
		</div>
	);
}

export function Sidebar() {
	return (
		<div className="flex flex-col h-full relative">
			<SidebarHeader />
			<EmptyList />
			<SidebarBody />
			<FirstTimePopup />
			{quotedSelection.value && <QuotePopup />}
		</div>
	);
}
