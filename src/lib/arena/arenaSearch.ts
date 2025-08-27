/**
 * Arena search functionality for the selection popup
 * Sends search requests to backend which handles Arena API and database
 */

import type { ArenaSearchAPIResponse } from "@/api/arena/routes";

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
    console.log(`🔍 Searching Arena for: "${searchText}"`);
    
    const apiUrl = import.meta.env.VITE_ARENA_API_URL || 'http://localhost:3000';
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
    
    console.log(`✅ Found ${data.channelCount} channels for "${searchText}"`);
    
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
  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'arena-search-toast';
  
  const arenaUrl = createArenaSearchUrl(searchText);
  const isClickable = result.success && result.channelCount > 0;
  
  toast.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${result.success ? '#4ade80' : '#f87171'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      font-family: system-ui;
      font-size: 14px;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
      cursor: ${isClickable ? 'pointer' : 'default'};
      transition: transform 0.2s ease;
    " ${isClickable ? `onclick="window.open('${arenaUrl}', '_blank')"` : ''}>
      ${result.success && result.channelCount > 0 
        ? `✓ Found ${result.channelCount} channels for "${searchText}"<br><small style="opacity: 0.8;">Click to view on Arena</small>` 
        : result.message}
    </div>
  `;
  
  // Add animation and hover styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    .arena-search-toast div:hover {
      transform: ${isClickable ? 'scale(1.02)' : 'none'};
    }
  `;
  document.head.appendChild(style);
  
  // Show toast
  document.body.appendChild(toast);
  
  // Remove after 5 seconds (longer since it's now clickable)
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => {
      toast.remove();
      style.remove();
    }, 300);
  }, 5000);
}