import { useEffect } from "preact/hooks";
import { effect, signal } from "@preact/signals";
import { TabbedSidebar } from "@/src/components/TabbedSidebar";
import { AppLayout, SidebarContent } from "@/src/components/AppLayout";
import { currentUrl } from "@/src/lib/messaging";
import { MarkdownSite } from "@/henry-ink/components/MarkdownSite";
import { contentStateSignal, activeTabSignal, contentModeSignal } from "@/henry-ink/signals";
import { isDarkMode } from "@/src/lib/settings";
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

// Apply dark mode class when isDarkMode signal changes
effect(() => {
	if (isDarkMode.value) {
		document.documentElement.classList.add('dark');
	} else {
		document.documentElement.classList.remove('dark');
	}
});

// Helper function to determine if a color is dark
function isColorDark(color: string): boolean {
	// Parse rgb values from color string
	const rgb = color.match(/\d+/g);
	if (!rgb || rgb.length < 3) return false;
	
	// Convert to 0-1 range and calculate luminance
	const [r, g, b] = rgb.map(x => parseInt(x) / 255);
	const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
	
	// Consider dark if luminance < 50%
	return luminance < 0.5;
}

// Helper function to check if background is valid (not empty/default)
function isValidBackground(background: string): boolean {
	return !!background && 
		background !== 'rgba(0, 0, 0, 0)' && 
		background !== 'transparent' &&
		background !== 'initial' &&
		background !== 'inherit' &&
		background !== 'none' &&
		// Filter out the verbose default background shorthand
		!background.includes('rgba(0, 0, 0, 0) none repeat scroll 0% 0% / auto padding-box border-box');
}

// Extract and apply archived site background color to henry.ink body
effect(() => {
	const contentState = contentStateSignal.value;
	const contentMode = contentModeSignal.value;
	
	if (contentMode === 'archive' && contentState.type === 'success') {
		// Wait for DOM to render archive content
		setTimeout(() => {
			// Check background colors in priority order
			const selectors = [
				'.archive-mode-html',
				'.archive-mode-body',
				'.archive-mode'
			];
			
			for (const selector of selectors) {
				const element = document.querySelector(selector);
				if (element) {
					const background = getComputedStyle(element).background;
					
					if (isValidBackground(background)) {
						// Apply full background (including gradients) to henry.ink body
						document.body.style.background = background;
						
						// Extract first color from background for dark mode detection
						const firstColor = background.match(/rgba?\([^)]+\)/)?.[0];
						if (firstColor && isColorDark(firstColor)) {
							isDarkMode.value = true;
						} else {
							isDarkMode.value = false;
						}
						break;
					}
				}
			}
		}, 100);
	} else {
		// Reset background and let theme system handle dark mode
		// document.body.style.background = '';
		// Note: Don't reset isDarkMode here as it should respect user's theme preference
	}
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
