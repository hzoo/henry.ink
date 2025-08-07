import { computed, signal } from "@preact/signals";
import type { ArenaMatch, ArenaBlock } from "./arena-types";

// Location signal that updates on popstate/navigation
export const locationSignal = signal(typeof window !== 'undefined' ? window.location.search : '');

// Initialize and listen for browser navigation
if (typeof window !== 'undefined') {
  // Initialize from current URL on load
  locationSignal.value = window.location.search;
  
  // Listen for browser navigation (back/forward)
  window.addEventListener('popstate', () => {
    locationSignal.value = window.location.search;
  });
}

// Get URL search params (reactive to location changes)
function getUrlParams() {
  // Access the signal to make this reactive
  const search = locationSignal.value;
  return new URLSearchParams(search);
}

// URL-driven navigation state
export const arenaUrlState = computed(() => {
  const params = getUrlParams();
  const channelSlug = params.get('channel');
  const blockId = params.get('block');
  
  return {
    route: channelSlug ? 'channel' : 'list' as const,
    channelSlug,
    blockId: blockId ? parseInt(blockId, 10) : null
  };
});

// Navigation functions using URL manipulation
export function navigateToChannel(channel: ArenaMatch) {
  const currentPath = window.location.pathname;
  const newUrl = `${currentPath}?channel=${channel.slug}`;
  window.history.pushState({}, '', newUrl);
  
  // Update location signal for reactive updates
  locationSignal.value = `?channel=${channel.slug}`;
}

export function openBlockOverlay(block: ArenaBlock, channelSlug?: string) {
  // Get channel slug from parameter or URL
  let targetChannelSlug = channelSlug;
  if (!targetChannelSlug) {
    const params = getUrlParams();
    targetChannelSlug = params.get('channel') || undefined;
  }
  
  if (!targetChannelSlug) {
    console.error('No channel context for block overlay');
    return;
  }
  
  const currentPath = window.location.pathname;
  const newUrl = `${currentPath}?channel=${targetChannelSlug}&block=${block.id}`;
  window.history.pushState({}, '', newUrl);
  
  // Update location signal
  locationSignal.value = `?channel=${targetChannelSlug}&block=${block.id}`;
}

// Note: navigateToNextBlock and navigateToPrevBlock removed
// BlockViewerOverlay now handles its own navigation using local data

export function closeBlockOverlay() {
  const params = getUrlParams();
  const channelSlug = params.get('channel');
  
  if (channelSlug) {
    const currentPath = window.location.pathname;
    const newUrl = `${currentPath}?channel=${channelSlug}`;
    window.history.pushState({}, '', newUrl);
    
    // Update location signal
    locationSignal.value = `?channel=${channelSlug}`;
  } else {
    navigateToChannelList();
  }
}

export function navigateToChannelList() {
  const currentPath = window.location.pathname;
  window.history.pushState({}, '', currentPath);
  
  // Update location signal
  locationSignal.value = '';
}

export function navigateBack() {
  window.history.back();
}