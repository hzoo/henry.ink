import { useEffect } from "preact/hooks";
import { effect, signal } from "@preact/signals";
import { TabbedSidebar } from "@/src/components/TabbedSidebar";
import { AppLayout, SidebarContent } from "@/src/components/AppLayout";
import { currentUrl } from "@/src/lib/messaging";
import { MarkdownSite } from "@/henry-ink/components/MarkdownSite";
import { contentStateSignal } from "@/henry-ink/signals";

const targetPostRkey = signal<string | null>(null);


// Update page title based on content title or current URL
effect(() => {
	const contentState = contentStateSignal.value;

	if (contentState.type === "success" && contentState.title) {
		document.title = `${contentState.title}`;
	} else if (currentUrl.value) {
		try {
			const url = new URL(currentUrl.value);
			const pathname = url.pathname === "/" ? "" : url.pathname;
			document.title = `${url.hostname}${pathname}`;
		} catch {
			document.title = `${currentUrl.value}`;
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
	// Parse URL parameters for post targeting
	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const postParam = urlParams.get('post');
		targetPostRkey.value = postParam;
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
