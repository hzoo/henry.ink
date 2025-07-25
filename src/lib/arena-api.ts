/**
 * Shared Arena API functions
 */

import type { ArenaApiResponse, ArenaMatch } from './arena-types';

/**
 * Fetch Arena matches from the API
 */
export async function fetchArenaMatches(content: string): Promise<ArenaMatch[]> {
  const apiUrl = import.meta.env.VITE_ARENA_API_URL || 'http://localhost:3001';
  
  const response = await fetch(`${apiUrl}/enhance`, {
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
  
  return result.matches.map((match) => {
    const contextStart = Math.max(0, match.bestMatch.position - 50);
    const contextEnd = Math.min(content.length, match.bestMatch.endPosition + 50);
    const context = content.substring(contextStart, contextEnd);
    
    return {
      slug: match.slug,
      title: match.title,
      matchedText: match.bestMatch.matchedText,
      context: context.trim(),
      url: `https://are.na/channels/${match.slug}`
    };
  });
}

/**
 * Query key factory for Arena matches
 */
export const arenaQueryKeys = {
  matches: (content: string | null) => ['arenaMatches', content] as const,
};