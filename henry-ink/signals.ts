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

// Arena view mode with localStorage persistence
export type ArenaViewMode = 'compact' | 'preview';

// Initialize from localStorage or default to compact
const getInitialArenaViewMode = (): ArenaViewMode => {
  if (typeof window === 'undefined') return 'compact';
  
  try {
    const stored = localStorage.getItem('arena-view-mode');
    return (stored === 'preview' || stored === 'compact') ? stored as ArenaViewMode : 'compact';
  } catch {
    return 'compact';
  }
};

export const arenaViewModeSignal = signal<ArenaViewMode>(getInitialArenaViewMode());

// Save to localStorage whenever the signal changes
if (typeof window !== 'undefined') {
  arenaViewModeSignal.subscribe((value) => {
    try {
      localStorage.setItem('arena-view-mode', value);
    } catch (error) {
      console.warn('Failed to save arena view mode to localStorage:', error);
    }
  });
}