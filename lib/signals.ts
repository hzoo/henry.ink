import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { signal } from "@preact/signals";
import { signalBrowserLocal } from "@/lib/signal";

export const currentPosts = signal<PostView[]>([]);
export const cacheTimeAgo = signal<number | null>(null);
export const loading = signal(false);
export const error = signal<string | null>(null);
export const contentSourceUrl = signal<string>("");

export const mode = signalBrowserLocal<"full" | "compact">("mode", "full");

