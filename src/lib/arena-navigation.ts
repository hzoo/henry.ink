import { computed, signal } from "@preact/signals";
import type { ArenaBlock } from "@/src/lib/arena-types";
import { withReaderParams } from "@/henry-ink/reader/url";

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

// Reader navigation keeps the source query and fragment intact.
function setReaderParams(changes: Parameters<typeof withReaderParams>[1]) {
  window.history.pushState({}, '', withReaderParams(window.location.href, changes));
  locationSignal.value = window.location.search;
}

export function navigateToChannel(slug: string) {
  setReaderParams({ channel: slug, block: null, post: null });
  window.dispatchEvent(new Event('henry:show-notes'));
}

export function openBlockOverlay(block: ArenaBlock, channelSlug = arenaUrlState.peek().channelSlug || undefined) {
  if (channelSlug) setReaderParams({ channel: channelSlug, block: String(block.id), post: null });
}

export function closeBlockOverlay() {
  setReaderParams({ block: null });
}

export function navigateToChannelList() {
  setReaderParams({ channel: null, block: null });
}
