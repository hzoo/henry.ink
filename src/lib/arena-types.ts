/**
 * Shared types for Arena integration
 */

// Raw API response from Arena service
export interface ArenaApiMatch {
  slug: string;
  title: string;
  author_name: string;
  contents_count: number;
  bestMatch: {
    matchedText: string;
    position: number;
    endPosition: number;
  };
}

export interface ArenaApiResponse {
  matches: ArenaApiMatch[];
}

// Processed Arena match used in UI components
export interface ArenaMatch {
  slug: string;
  title: string;
  matchedText: string;
  context?: string; // Used by sidebar for preview text
  url: string;
}

// Arena match with position data (for navigation)
export interface ArenaMatchWithPosition extends ArenaMatch {
  position: number;
  endPosition: number;
}