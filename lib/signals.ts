import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { signal } from "@preact/signals";

import { signalL } from "@/lib/signal";

export const currentPosts = signal<PostView[]>([]);
export const loading = signal(false);
export const error = signal<string | null>(null);
export const contentSourceUrl = signal<string>("");

export const mode = signalL<"full" | "compact">("mode", "full");

// Search parameters
export const searchSort = signal<'top' | 'latest'>('top');
export const searchAuthor = signal<string | null>(null);
