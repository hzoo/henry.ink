import { computed, signal } from "@preact/signals";
import { domainSettings } from "./settings";

export function extractBaseDomain(url: string): string {
	try {
		const { hostname } = new URL(url);
		return hostname;
	} catch {
		return "";
	}
}

// --- Signals for Sidepanel State ---

export const currentUrl = signal<string>("");
export const currentDomain = computed(() =>
	currentUrl.value ? extractBaseDomain(currentUrl.value) : "",
);
export const isAllowed = computed(() =>
	domainSettings.value[currentDomain.value] === 'a'
);
export const isBlocked = computed(() =>
	domainSettings.value[currentDomain.value] === 'b'
);
// Signal to hold the latest selection action data received from the sidepanel
export const quotedSelection = signal<string | null>(null);

// Signal to show comment dialog without text selection
export const showCommentDialog = signal<boolean>(false);

// Signal for arena match navigation (text to highlight)
export const arenaNavigationRequest = signal<{ matchedText: string } | null>(null);

// Check if URL is valid for searching (not browser internal, etc)
export const isSearchableUrl = computed(() => {
	const url = currentUrl.value;
	if (!url) return false;

	// not searchable
	if (isBlocked.value) return false;

	try {
		const parsedUrl = new URL(url);
		// Only allow http and https protocols
		return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
	} catch {
		return false;
	}
});