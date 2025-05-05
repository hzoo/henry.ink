import { computed, signal } from "@preact/signals";
import { whitelistedDomains } from "./settings";

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
export const isWhitelisted = computed(() =>
	whitelistedDomains.value.includes(currentDomain.value),
);
// Signal to hold the latest selection action data received from the sidepanel
export const quotedSelection = signal<string | null>(null);

// Check if URL is valid for searching (not browser internal, etc)
export const isSearchableUrl = computed(() => {
	const url = currentUrl.value;
	if (!url) return false;
	
	try {
		const parsedUrl = new URL(url);
		// Only allow http and https protocols
		return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
	} catch {
		return false;
	}
});