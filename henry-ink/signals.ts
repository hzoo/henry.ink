import { signal } from "@preact/signals";

// Content mode types
export type ContentMode = 'md' | 'archive';

// Content loading state
export type ContentState = 
  | { type: 'idle' }
  | { type: 'loading'; mode: ContentMode }
  | { type: 'success'; content: string; title?: string; mode: ContentMode; html?: string; css?: string; htmlAttrs?: any; bodyAttrs?: any }
  | { type: 'error'; message: string; mode: ContentMode };

export const contentStateSignal = signal<ContentState>({ type: 'idle' });

// Content mode signal with localStorage persistence
const getInitialContentMode = (): ContentMode => {
  if (typeof window === 'undefined') return 'md';
  
  try {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    if (modeParam === 'archive' || modeParam === 'md') {
      return modeParam as ContentMode;
    }
    
    const stored = localStorage.getItem('content-mode');
    return (stored === 'archive' || stored === 'md') ? stored as ContentMode : 'md';
  } catch {
    return 'md';
  }
};

export const contentModeSignal = signal<ContentMode>(getInitialContentMode());

// Save to localStorage and update URL when mode changes
if (typeof window !== 'undefined') {
  contentModeSignal.subscribe((value) => {
    try {
      localStorage.setItem('content-mode', value);
      
      // Update URL parameter without reloading
      const url = new URL(window.location.href);
      if (value === 'md') {
        url.searchParams.delete('mode');
      } else {
        url.searchParams.set('mode', value);
      }
      window.history.replaceState({}, '', url.toString());
    } catch (error) {
      console.warn('Failed to update content mode:', error);
    }
  });
}

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