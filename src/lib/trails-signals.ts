/**
 * Central signal store for trails feature
 * Replaces useState/useEffect patterns with reactive signals
 */
import { signal, computed } from "@preact/signals";
// Use window.location for navigation to avoid circular dependency issues
import type { TrailView } from "@/api/trails/types";

// === CORE DATA SIGNALS ===

// All trails data (global and user-specific)
export const trailsData = signal<TrailView[]>([]);
export const currentTrailData = signal<{ trail: any; marks: any[] } | null>(null);

// Loading states
export const trailsLoading = signal(false);
export const trailsError = signal<string | null>(null);

// User profile data
export const currentUserDid = signal<string | null>(null);
export const currentUsername = signal<string | null>(null);
export const profileTrailsCount = signal<number>(0);

// === UI STATE SIGNALS ===

// Search and filtering
export const searchQuery = signal('');
export const sortBy = signal<'recent' | 'marks' | 'updated'>('recent');
export const authorFilter = signal<string | null>(null);

// Trail detail view
export const selectedTrailUri = signal<string | null>(null);

// Page title management
export const pageTitle = signal<string>('');

// === COMPUTED SIGNALS ===

// Filtered and sorted trails
export const filteredTrails = computed(() => {
  let trails = trailsData.value;
  
  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    trails = trails.filter(trail => 
      trail.name.toLowerCase().includes(query) ||
      (trail.description && trail.description.toLowerCase().includes(query))
    );
  }
  
  // Apply sorting
  return trails.sort((a, b) => {
    switch (sortBy.value) {
      case 'marks':
        return (b.markCount || 0) - (a.markCount || 0);
      case 'updated':
        return new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime();
      case 'recent':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });
});

// Profile trails (trails for current profile being viewed)
export const profileTrails = computed(() => {
  if (!currentUserDid.value) return [];
  return trailsData.value.filter(trail => 
    trail.creator.did === currentUserDid.value
  );
});

// === ACTIONS ===

// Navigation actions
export const navigateToTrail = (authorIdentifier: string, rkey: string) => {
  window.location.href = `/profile/${authorIdentifier}/trail/${rkey}`;
};

export const navigateToProfile = (username: string) => {
  window.location.href = `/profile/${username}`;
};

// Data management actions
export const setTrailsData = (trails: TrailView[]) => {
  trailsData.value = trails;
};

export const addTrail = (trail: TrailView) => {
  trailsData.value = [...trailsData.value, trail];
};

export const updateTrail = (uri: string, updates: Partial<TrailView>) => {
  trailsData.value = trailsData.value.map(trail =>
    trail.uri === uri ? { ...trail, ...updates } : trail
  );
};

export const removeTrail = (uri: string) => {
  trailsData.value = trailsData.value.filter(trail => trail.uri !== uri);
};

// Loading state management
export const setTrailsLoading = (loading: boolean) => {
  trailsLoading.value = loading;
};

export const setTrailsError = (error: string | null) => {
  trailsError.value = error;
};

export const clearTrailsError = () => {
  trailsError.value = null;
};

// Profile state management
export const setCurrentUser = (did: string | null, username: string | null) => {
  currentUserDid.value = did;
  currentUsername.value = username;
};

export const setProfileTrailsCount = (count: number) => {
  profileTrailsCount.value = count;
};

// Page title management
export const updatePageTitle = (title: string) => {
  pageTitle.value = title;
  document.title = title;
};

// UI state management
export const setSearchQuery = (query: string) => {
  searchQuery.value = query;
};

export const setSortBy = (sort: 'recent' | 'marks' | 'updated') => {
  sortBy.value = sort;
};

export const selectTrail = (uri: string | null) => {
  selectedTrailUri.value = uri;
};

// Scroll to element with smooth behavior
export const scrollToElement = (elementId: string) => {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// === UTILITY FUNCTIONS ===

// Format relative time (moved from components)
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears}y ago`;
};

// Get sort label for UI display
export const getSortLabel = computed(() => {
  switch (sortBy.value) {
    case 'marks': return 'Most Marks';
    case 'updated': return 'Recently Updated';
    case 'recent': default: return 'Recently Created';
  }
});

// Reset all state (useful for cleanup)
export const resetTrailsState = () => {
  trailsData.value = [];
  currentTrailData.value = null;
  trailsLoading.value = false;
  trailsError.value = null;
  currentUserDid.value = null;
  currentUsername.value = null;
  profileTrailsCount.value = 0;
  searchQuery.value = '';
  sortBy.value = 'recent';
  selectedTrailUri.value = null;
};