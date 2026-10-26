/**
 * Aho-Corasick pattern matcher with smart filtering
 * Efficiently finds multiple channel patterns in text content
 */

import AhoCorasick from 'modern-ahocorasick';
import type { ChannelPattern } from './channel-storage';

export interface PatternMatch {
  pattern: ChannelPattern;
  position: number;
  endPosition: number;
  matchedText: string;
}

export interface MatchResult {
  slug: string;
  title: string;
  author_name: string;
  author_slug?: string;
  contents_count: number;
  updated_at?: string;
  matches: PatternMatch[];
  bestMatch: PatternMatch;
}

export class ChannelPatternMatcher {
  private ac: AhoCorasick | null = null;
  private patternLookup: Map<string, ChannelPattern> = new Map();

  /**
   * Build Aho-Corasick automaton from channel patterns
   */
  buildFromPatterns(patterns: ChannelPattern[], normalizeFunction: (text: string) => string): void {
    this.patternLookup.clear();

    // Prepare patterns for Aho-Corasick using provided normalization
    const keywords: string[] = [];
    
    for (const pattern of patterns) {
      const normalizedText = normalizeFunction(pattern.text);
      if (normalizedText.length > 0) { // Skip empty normalized patterns
        keywords.push(normalizedText);
        this.patternLookup.set(normalizedText, pattern);
      }
    }

    // Build the automaton
    this.ac = new AhoCorasick(keywords);
  }

  /**
   * Find all channel matches in text with smart filtering
   */
  findMatches(text: string, normalizeFunction: (text: string) => string): MatchResult[] {
    if (!this.ac) {
      throw new Error('Pattern matcher not initialized. Call buildFromPatterns() first.');
    }

    // Search for all patterns in normalized text
    const normalizedText = normalizeFunction(text);
    
    
    const rawMatches = this.ac.search(normalizedText);
    
    
    // Convert to our match format with simple filtering
    const patternMatches: PatternMatch[] = [];
    
    for (const [endPosition, matchedPatterns] of rawMatches) {
      for (const matchedPattern of matchedPatterns) {
        const pattern = this.patternLookup.get(matchedPattern);
        if (!pattern) continue;

        const startPosition = endPosition - matchedPattern.length + 1;
        const originalMatchedText = text.substring(startPosition, endPosition + 1);

        // Check word boundaries: only reject if we're splitting a continuous word
        const charBefore = startPosition > 0 ? text[startPosition - 1] : ' ';
        const charAfter = endPosition < text.length - 1 ? text[endPosition + 1] : ' ';
        
        // A match is valid if it's at word boundaries OR separated by non-alphanumeric chars
        const validBefore = !(/[a-zA-Z0-9]/.test(charBefore)) || /\s/.test(charBefore);
        const validAfter = !(/[a-zA-Z0-9]/.test(charAfter)) || /\s/.test(charAfter);
        
        // Skip only if we're clearly breaking an existing word (no spaces/punctuation)
        if (!validBefore || !validAfter) {
          continue;
        }
        
        patternMatches.push({
          pattern,
          position: startPosition,
          endPosition,
          matchedText: originalMatchedText
        });
      }
    }

    // Group matches by channel slug and select best match per channel
    const channelMatches = this.groupAndRankMatches(patternMatches);
    
    return channelMatches;
  }


  /**
   * Group matches by channel and select the best match per channel
   */
  private groupAndRankMatches(matches: PatternMatch[]): MatchResult[] {
    const channelGroups = new Map<string, PatternMatch[]>();
    
    // Group by channel slug
    for (const match of matches) {
      const slug = match.pattern.slug;
      if (!channelGroups.has(slug)) {
        channelGroups.set(slug, []);
      }
      channelGroups.get(slug)!.push(match);
    }
    
    const results: MatchResult[] = [];
    
    for (const [slug, channelMatches] of channelGroups) {
      // Sort matches by length (prefer longer matches)
      channelMatches.sort((a, b) => b.matchedText.length - a.matchedText.length);
      
      const bestMatch = channelMatches[0];
      
      results.push({
        slug,
        title: bestMatch.pattern.title,
        author_name: bestMatch.pattern.author_name,
        author_slug: bestMatch.pattern.author_slug,
        contents_count: bestMatch.pattern.contents_count,
        updated_at: bestMatch.pattern.updated_at,
        matches: channelMatches,
        bestMatch
      });
    }
    
    // Sort results by content count (prioritize higher quality channels)
    results.sort((a, b) => b.contents_count - a.contents_count);
    
    return results;
  }

}
