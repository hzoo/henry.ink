import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import { signal } from "@preact/signals";
import type { Signal } from "@preact/signals";
import { signalBrowserLocal } from "@/lib/signal";
import type { ThreadReply } from "@/lib/types"; // Assuming ThreadReply is defined here

export const currentPosts = signal<AppBskyFeedDefs.PostView[]>([]);
export const cacheTimeAgo = signal<number | null>(null);
export const loading = signal(false);
export const error = signal<string | null>(null);
export const contentSourceUrl = signal<string>("");

export interface ThreadState {
  data: ThreadReply[] | null; 
  lastFetched: number | null;
  isLoading: boolean;
  error: string | null;
}

// Map where key is the root post URI, value is the signal for that thread's state
export const threadsStore = signal(new Map<string, Signal<ThreadState>>());

// Helper function to get or initialize a thread signal
export function getThreadSignal(uri: string): Signal<ThreadState> {
  const store = threadsStore.peek(); // Use peek to avoid subscribing components that just need the signal instance
  if (!store.has(uri)) {
    const newSignal = signal<ThreadState>({
      data: null,
      lastFetched: null,
      isLoading: false,
      error: null,
    });
    // Create a new map to trigger updates for components observing the map itself (if any)
    threadsStore.value = new Map(store.set(uri, newSignal));
    return newSignal;
  }
  return store.get(uri)!;
}

// -------------------------

// Signal to track the last version the user has seen the intro/update popup for
export const lastSeenVersion = signalBrowserLocal<string>("last-seen-version", "0.0.0");