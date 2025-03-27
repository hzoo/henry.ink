import { useSignalEffect } from "@preact/signals";
import { currentUrl } from "@/lib/messaging";
import { LoadingItemList } from "@/components/LoadingItem";
import { ErrorMessage } from "@/components/ErrorMessage";
import { SidebarHeader } from "@/components/SidebarHeader";
import { EmptyList } from "@/components/EmptyList";
import { contentItems, loading, error, contentSourceUrl } from "@/lib/signals";
import { autoFetchEnabled, extractBaseDomain, isDomainWhitelisted } from "@/lib/settings";
import { searchBskyPosts } from "@/lib/bsky";
import { PostList } from "@/components/PostList";

function SidebarBody() {
	// Load content when URL changes
	useSignalEffect(() => {
		const newUrl = currentUrl.value;
		
		if (newUrl) {
			// Update content source URL
			contentSourceUrl.value = newUrl;
			
			// Only fetch if auto-fetch is enabled AND domain is whitelisted
			if (autoFetchEnabled.value && isDomainWhitelisted(extractBaseDomain(newUrl))) {
				loading.value = true;
				error.value = '';
				
				searchBskyPosts(newUrl)
					.then(posts => {
						contentItems.value = posts;
						console.log(contentItems.value.slice(0, 5));
						loading.value = false;
					})
					.catch(err => {
						error.value = err.message || 'Failed to fetch Bluesky posts';
						loading.value = false;
					});
			}
		}
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
		<div className="flex flex-col h-full">
			<SidebarHeader />
			{contentItems.value.length === 0 && !loading.value && !error.value && <EmptyList />}
			<SidebarBody />
		</div>
	);
}
