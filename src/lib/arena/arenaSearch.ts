/**
 * Arena search functionality for the selection popup
 * Sends search requests to backend which handles Arena API and database
 */

import type { ArenaSearchAPIResponse } from "@/api/arena/routes";
import { apiBase } from '@/src/lib/api-url';

export interface ArenaSearchResult {
  success: boolean;
  channelCount: number;
  message: string;
}

/**
 * Search Arena for channels matching the selected text
 * Backend handles Arena API call and database storage
 */
export async function searchAndSaveArenaChannels(searchText: string): Promise<ArenaSearchResult> {
  if (!searchText || searchText.trim().length < 2) {
    return {
      success: false,
      channelCount: 0,
      message: 'Search text too short'
    };
  }

  try {
    const apiUrl = apiBase;
    const response = await fetch(`${apiUrl}/api/arena/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: searchText })
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const data = await response.json() as ArenaSearchAPIResponse;
    
    return {
      success: true,
      channelCount: data.channelCount,
      message: data.channelCount > 0 
        ? `Found ${data.channelCount} channels` 
        : 'No channels found'
    };
    
  } catch (error) {
    console.error('Arena search error:', error);
    return {
      success: false,
      channelCount: 0,
      message: 'Search failed'
    };
  }
}

/**
 * Create Arena search URL with the search term
 */
function createArenaSearchUrl(searchText: string): string {
  const searchQuery = {
    term: { facet: searchText },
    where: [{ facet: "ALL" }],
    what: { facets: ["CHANNEL"] },
    fields: { facets: ["ALL"] },
    order: { facet: "SCORE", dir: "DESC" }
  };
  
  const encodedQuery = encodeURIComponent(JSON.stringify(searchQuery));
  return `https://www.are.na/search?q=${encodedQuery}`;
}

/**
 * Show a toast notification with the search result
 */
export function showArenaToast(result: ArenaSearchResult, searchText: string) {
  const toast = document.createElement('div');
  toast.className = 'arena-search-toast';
  toast.setAttribute('role', 'status');
  // This utility also runs in extension content scripts without the app CSS.
  toast.style.cssText = `position:fixed;bottom:20px;right:20px;max-width:calc(100vw - 40px);box-sizing:border-box;padding:12px 16px;border-radius:8px;box-shadow:0 4px 12px #0002;font:14px/1.4 system-ui;z-index:10000;background:${result.success ? '#dcfce7' : '#fee2e2'};color:${result.success ? '#14532d' : '#7f1d1d'}`;
  const isClickable = result.success && result.channelCount > 0;
  if (isClickable) {
    const link = document.createElement('a');
    link.href = createArenaSearchUrl(searchText);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.cssText = 'display:block;color:inherit;text-decoration:underline;overflow-wrap:anywhere';
    link.textContent = `View ${result.channelCount} ${result.channelCount === 1 ? 'channel' : 'channels'} for “${searchText}” on Are.na`;
    toast.appendChild(link);
  } else {
    toast.textContent = result.message;
  }
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}
