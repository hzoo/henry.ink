import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import { signal } from "@preact/signals";
import { signalBrowserLocal } from "@/lib/signal";

export const currentPosts = signal<AppBskyFeedDefs.PostView[]>([]);
export const cacheTimeAgo = signal<number | null>(null);
export const loading = signal(false);
export const error = signal<string | null>(null);
export const contentSourceUrl = signal<string>("");

export const mode = signalBrowserLocal<"full" | "compact">("mode", "full");

