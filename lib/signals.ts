import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import { signal } from "@preact/signals";
import type { Signal } from "@preact/signals";
import type { ThreadReply } from "@/lib/types"; // Assuming ThreadReply is defined here

// Define a type for the error state
export interface ErrorState {
  message: string;
  link?: string;
}

export const currentPosts = signal<AppBskyFeedDefs.PostView[]>([]);
export const cacheTimeAgo = signal<number | null>(null);
export const loading = signal(false);
// Update error signal to use the ErrorState type or string for simpler errors
export const error = signal<ErrorState | string | null>(null);
export const contentSourceUrl = signal<string>("");

export interface ThreadState {
  post: AppBskyFeedDefs.PostView | null;
  data: ThreadReply[] | null; 
  lastFetched: number | null;
  isLoading: boolean;
  error: string | null;
}

// Map where key is the root post URI, value is the signal for that thread's state
export const threadsStore = new Map<string, Signal<ThreadState>>();

// Helper function to get or initialize a thread signal
export function getThreadSignal(uri: string): Signal<ThreadState> {
  if (!threadsStore.has(uri)) {
    const newSignal = signal<ThreadState>({
      post: null,
      data: null,
      lastFetched: null,
      isLoading: false,
      error: null,
    });
    threadsStore.set(uri, newSignal);
    return newSignal;
  }
  return threadsStore.get(uri)!;
}

// Signal to track which post's collapse controls (line/button) are hovered
export const hoveredCollapsePostUri = signal<string | null>(null);