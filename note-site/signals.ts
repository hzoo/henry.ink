import { signal } from "@preact/signals";

// Content loading state
export type ContentState = 
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; content: string }
  | { type: 'error'; message: string };

export const contentStateSignal = signal<ContentState>({ type: 'idle' });