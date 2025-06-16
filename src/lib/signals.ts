import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { effect, signal } from "@preact/signals";
import { currentUrl } from "./messaging";
import { isSearchableUrl } from "./messaging";

// Define a type for the error state
export interface ErrorState {
  message: string;
  link?: string;
}

export const currentPosts = signal<AppBskyFeedDefs.PostView[]>([]);
export const cacheTimeAgo = signal<number | null>(null);
export const contentSourceUrl = signal<string>("");

effect(() => {
	if (isSearchableUrl.value) {
		contentSourceUrl.value = currentUrl.value;
	}
});

// Signal to track which post's collapse controls (line/button) are hovered
export const hoveredCollapsePostUri = signal<string | null>(null);