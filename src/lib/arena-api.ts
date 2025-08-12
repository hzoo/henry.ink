/**
 * Shared Arena API functions
 */

import type { ArenaApiResponse, ArenaMatch, ArenaChannelWithBlocks } from './arena-types';

/**
 * Fetch Arena matches from the API
 */
export async function fetchArenaMatches(content: string): Promise<ArenaMatch[]> {
  const apiUrl = import.meta.env.VITE_ARENA_API_URL || 'http://localhost:3000';
  
  const response = await fetch(`${apiUrl}/api/arena/enhance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
      options: { maxLinksPerChannel: 1 }
    }),
  });

  if (!response.ok) {
    throw new Error(`Arena service returned ${response.status}`);
  }

  const result: ArenaApiResponse = await response.json();
  
  return result.matches
    .filter(match => match.contents_count > 1) // Filter out channels with only 1 block
    .map((match) => {
      const contextStart = Math.max(0, match.bestMatch.position - 50);
      const contextEnd = Math.min(content.length, match.bestMatch.endPosition + 50);
      const context = content.substring(contextStart, contextEnd);
      
      return {
        slug: match.slug,
        title: match.title,
        matchedText: match.bestMatch.matchedText,
        context: context.trim(),
        url: `https://are.na/channels/${match.slug}`,
        author_name: match.author_name,
        author_slug: match.author_slug,
        contents_count: match.contents_count,
        updated_at: match.updated_at
      };
    });
}

/**
 * Fetch blocks for a specific Arena channel
 */
export async function fetchChannelBlocks(slug: string, per: number = 24, page: number = 1): Promise<ArenaChannelWithBlocks | null> {
  const apiUrl = import.meta.env.VITE_ARENA_API_URL || 'http://localhost:3000';
  
  const response = await fetch(`${apiUrl}/api/arena/channel-blocks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ slug, per, page }),
  });

  if (!response.ok) {
    throw new Error(`Arena service returned ${response.status}`);
  }

  const result: ArenaChannelWithBlocks | null = await response.json();
  return result;
}

/**
 * Format relative time for Arena channels
 */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  
  if (diffMonths > 0) return `~${diffMonths}mo`;
  if (diffWeeks > 0) return `~${diffWeeks}w`;
  if (diffDays > 0) return `~${diffDays}d`;
  if (diffHours > 0) return `~${diffHours}h`;
  if (diffMins > 0) return `~${diffMins}m`;
  return 'now';
}

/**
 * Query key factory for Arena matches
 */
export const arenaQueryKeys = {
  matches: (url: string | null) => ['arenaMatches', url || 'unknown'] as const,
  blocks: (slug: string, per?: number, page?: number) => {
    if (per && page) {
      return ['arenaBlocks', slug, 'pagination', per, page] as const;
    }
    return ['arenaBlocks', slug] as const;
  },
};