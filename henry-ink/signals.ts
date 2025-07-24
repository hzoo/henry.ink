import { signal } from "@preact/signals";

// Content loading state
export type ContentState = 
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; content: string; title?: string }
  | { type: 'error'; message: string };

export const contentStateSignal = signal<ContentState>({ type: 'idle' });

// Tab state for sidebar
export type TabType = 'bluesky' | 'arena';
export const activeTabSignal = signal<TabType>('bluesky');