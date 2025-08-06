import { signal } from "@preact/signals";
import type { ArenaMatch } from "./arena-types";

export type ArenaNavigationRoute = 'channel-list' | 'channel-detail';

export interface ArenaNavigationState {
  route: ArenaNavigationRoute;
  selectedChannel: ArenaMatch | null;
  history: ArenaNavigationRoute[];
}

// Navigation state signals
export const arenaNavigationState = signal<ArenaNavigationState>({
  route: 'channel-list',
  selectedChannel: null,
  history: ['channel-list']
});

// Navigation actions
export function navigateToChannel(channel: ArenaMatch) {
  arenaNavigationState.value = {
    route: 'channel-detail',
    selectedChannel: channel,
    history: [...arenaNavigationState.value.history, 'channel-detail']
  };
}

export function navigateBack() {
  const currentHistory = arenaNavigationState.value.history;
  if (currentHistory.length > 1) {
    // Remove current route
    const newHistory = currentHistory.slice(0, -1);
    const previousRoute = newHistory[newHistory.length - 1];
    
    arenaNavigationState.value = {
      route: previousRoute,
      selectedChannel: previousRoute === 'channel-detail' ? arenaNavigationState.value.selectedChannel : null,
      history: newHistory
    };
  }
}

export function resetNavigation() {
  arenaNavigationState.value = {
    route: 'channel-list',
    selectedChannel: null,
    history: ['channel-list']
  };
}