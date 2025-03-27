import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { signal } from "@preact/signals";

export const contentItems = signal<PostView[]>([]);
export const loading = signal(false);
export const error = signal<string | null>(null);
export const contentSourceUrl = signal<string>("");
export const mode = signal<'full' | 'compact'>('full');
export const autoFetch = signal(true);

// Search parameters
export const searchSort = signal<'top' | 'latest'>('top');
export const searchAuthor = signal<string | null>(null);
