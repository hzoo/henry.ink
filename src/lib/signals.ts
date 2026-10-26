import { effect, signal } from "@preact/signals";
import { currentUrl } from "./messaging";
import { isSearchableUrl } from "./messaging";

// Define a type for the error state
export interface ErrorState {
  message: string;
  link?: string;
}

export const cacheTimeAgo = signal<number | null>(null);
export const contentSourceUrl = signal<string>("");

effect(() => {
	if (isSearchableUrl.value) {
		contentSourceUrl.value = currentUrl.value;
	}
});

// Signal to track if we've already shown an error in PostList
export const hasShownError = signal<boolean>(false);
