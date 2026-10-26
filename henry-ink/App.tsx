import { useEffect, useRef } from "preact/hooks";
import { effect, useSignalEffect } from "@preact/signals";
import { useLocation } from "preact-iso";
import { TabbedSidebar } from "@/src/components/TabbedSidebar";
import { AppLayout, SidebarContent } from "@/src/components/AppLayout";
import { currentUrl } from "@/src/lib/messaging";
import { MarkdownSite } from "@/henry-ink/components/MarkdownSite";
import { contentStateSignal, activeTabSignal, type ContentMode } from "@/henry-ink/signals";
import { isDarkMode } from "@/src/lib/settings";
import { locationSignal } from "@/src/lib/arena-navigation";
import { extractedQuotes, quotesUrl, readerAnchors, showReaderAnchor, targetPostRkey } from '@/src/lib/highlights/signals';

effect(() => {
	const params = new URLSearchParams(locationSignal.value);
	const post = params.get('post');
	targetPostRkey.value = post;
	if (params.get('channel')) {
		activeTabSignal.value = 'arena';
	} else if (post) {
		activeTabSignal.value = 'bluesky';
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

// Apply dark mode class when isDarkMode signal changes
effect(() => {
	if (isDarkMode.value) {
		document.documentElement.classList.add('dark');
	} else {
		document.documentElement.classList.remove('dark');
	}
});

export function App() {
	const location = useLocation();
	const completedJump = useRef<{ url: string; mode: ContentMode; post: string } | null>(null);
	useEffect(() => {
		const reader = new URL(location.url, window.location.origin);
		locationSignal.value = reader.search;
		if (reader.searchParams.has('channel')) {
			// Mount the Notes listener before opening a direct channel link.
			const frame = window.requestAnimationFrame(() => window.dispatchEvent(new Event('henry:show-notes')));
			return () => window.cancelAnimationFrame(frame);
		}
	}, [location.url]);

	useSignalEffect(() => {
		const target = targetPostRkey.value;
		const url = currentUrl.value;
		const article = contentStateSignal.value;
		const quotes = extractedQuotes.value;
		const placement = readerAnchors.value;
		if (!target || completedJump.current?.url !== url || completedJump.current?.post !== target) completedJump.current = null;
		if (!target || article.type !== 'success' || article.url !== url || quotesUrl.value !== url) return;
		if (completedJump.current?.mode === article.mode) return;
		const postQuotes = quotes.filter(quote => quote.postUri.split('/').at(-1) === target);
		const currentPlacement = placement?.article === article && placement.root.isConnected && placement.quotes === quotes;
		const placed = currentPlacement ? postQuotes.find(quote => placement.anchors.has(quote.id)) : undefined;
		if (placed) {
			completedJump.current = { url, mode: article.mode, post: target };
			showReaderAnchor(placed.id);
			return;
		}
		// Wait for this document's completed placement, then show the discussion
		// if a passage was removed or cannot be matched. Embeds have no text root.
		if (postQuotes.length && article.mode !== 'embed' && !currentPlacement) return;
		activeTabSignal.value = 'bluesky';
		window.dispatchEvent(new Event('henry:show-notes'));
		const frame = window.requestAnimationFrame(() => {
			// The target can expand PostList beyond its first page this render.
			const post = Array.from(document.querySelectorAll<HTMLElement>('[data-post-rkey]'))
				.find(element => element.dataset.postRkey === target);
			if (!post) return;
			completedJump.current = { url, mode: article.mode, post: target };
			post.scrollIntoView({ block: 'center' });
			post.tabIndex = -1;
			post.focus({ preventScroll: true });
		});
		return () => window.cancelAnimationFrame(frame);
	});

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
