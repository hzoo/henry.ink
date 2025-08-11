import { useEffect } from "preact/hooks";
import { effect, signal } from "@preact/signals";
import { TabbedSidebar } from "@/src/components/TabbedSidebar";
import { AppLayout, SidebarContent } from "@/src/components/AppLayout";
import { currentUrl } from "@/src/lib/messaging";
import { MarkdownSite } from "@/henry-ink/components/MarkdownSite";
import { contentStateSignal, activeTabSignal } from "@/henry-ink/signals";
import { fetchChannelBlocks, arenaQueryKeys } from "@/src/lib/arena-api";
import { queryClient } from "@/src/lib/queryClient";
import { arenaUrlState } from "@/src/lib/arena-navigation";

const targetPostRkey = signal<string | null>(null);

effect(() => {
	if (arenaUrlState.value.channelSlug) {
		activeTabSignal.value = 'arena';
	}
});

// Update page title based on content title or current URL
effect(() => {
	const contentState = contentStateSignal.value;

	if (contentState.type === "success" && contentState.title) {
		document.title = `${contentState.title} | Henry's Note`;
	} else if (currentUrl.value) {
		try {
			const url = new URL(currentUrl.value);
			const pathname = url.pathname === "/" ? "" : url.pathname;
			document.title = `${url.hostname}${pathname} | Henry's Note`;
		} catch {
			document.title = `${currentUrl.value} | Henry's Note`;
		}
	} else {
		document.title = "Henry's Note";
	}
});

// Auto-scroll to target post if specified
effect(() => {
	if (!targetPostRkey.value) return;
	
	// Wait for DOM to be rendered
	const timer = setTimeout(() => {
		// Priority 1: Look for content highlights first
		const contentHighlights = document.querySelectorAll(`[data-highlight-id*="${targetPostRkey.value}"]`);
		
		if (contentHighlights.length > 0) {
			// Scroll to the first highlight (likely suffix -0)
			const firstHighlight = contentHighlights[0];
			firstHighlight.scrollIntoView({
				behavior: "instant",
				block: "center",
			});
			
			// Apply blue pulse effect to ALL highlights from this post
			contentHighlights.forEach((highlight) => {
				const element = highlight as HTMLElement;
				const originalBackground = element.style.backgroundColor;
				element.style.backgroundColor = "rgba(59, 130, 246, 0.4)";
				setTimeout(() => {
					element.style.backgroundColor = originalBackground;
				}, 1500);
			});
		} else {
			// Priority 2: Fallback to sidebar post
			const sidebarPost = document.querySelector(`[data-post-rkey="${targetPostRkey.value}"]`);
			if (sidebarPost) {
				sidebarPost.scrollIntoView({
					behavior: "instant",
					block: "center",
				});
				
				// Add highlight effect to sidebar post
				const element = sidebarPost as HTMLElement;
				const originalBackground = element.style.backgroundColor;
				element.style.backgroundColor = "rgba(59, 130, 246, 0.4)";
				setTimeout(() => {
					element.style.backgroundColor = originalBackground;
				}, 1500);
			}
		}
	}, 100);
	
	return () => clearTimeout(timer);
});


export function App() {
	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const postParam = urlParams.get('post');
		targetPostRkey.value = postParam;
		
		// Handle arena deep linking
		const channelParam = urlParams.get('channel');
		const blockParam = urlParams.get('block');
		
		if (channelParam) {
			// Switch to arena tab for deep linking
			activeTabSignal.value = 'arena';
			
			// Prefetch channel blocks if we have a channel but no cached data
			const hasPreviewData = queryClient.getQueryData(arenaQueryKeys.blocks(channelParam, 24, 1));
			const hasInfiniteData = queryClient.getQueryData(arenaQueryKeys.blocks(channelParam));
			
			if (!hasPreviewData && !hasInfiniteData) {
				// Fetch (not just prefetch) blocks to support the block overlay
				// Using fetchQuery ensures data is available for deep linking
				queryClient.fetchQuery({
					queryKey: arenaQueryKeys.blocks(channelParam, 24, 1),
					queryFn: () => fetchChannelBlocks(channelParam, 24, 1),
					staleTime: 10 * 60 * 1000, // 10 minutes
				}).then(() => {
					// Data is now in cache, computed signals will update automatically
				});
			}
		}
	}, []);

	return (
		<AppLayout
			sidebar={
				<SidebarContent>
					<TabbedSidebar
						hidePopup
						autoAllowDomain={import.meta.env.DEV ? "127.0.0.1" : "henry.ink"}
					/>
				</SidebarContent>
			}
		>
			<MarkdownSite />
		</AppLayout>
	);
}
