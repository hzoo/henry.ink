/**
 * Wikipedia-style link enhancer with context awareness
 * Main orchestration for enhancing content with Arena channel links
 */

import type { ChannelStorage } from '@/api/arena/channel-storage';
import type { ChannelPatternMatcher, MatchResult } from '@/api/arena/pattern-matcher';

export interface EnhancementOptions {
  maxLinksPerChannel?: number;
}

export interface EnhancementResult {
  matches: MatchResult[];
}


export class LinkEnhancer {
  private storage: ChannelStorage;
  private matcher: ChannelPatternMatcher;
  private patternVersion?: string;

  constructor(
    storage: ChannelStorage,
    matcher: ChannelPatternMatcher
  ) {
    this.storage = storage;
    this.matcher = matcher;
  }

  /**
   * Initialize the enhancer by building pattern matcher
   */
  async initialize(): Promise<void> {
    await this.refreshPatterns();
  }

  /**
   * Refresh only when stored channel data has changed.
   */
  async refreshPatterns(): Promise<void> {
    const version = this.storage.getPatternVersion();
    if (version === this.patternVersion) return;
    const patterns = this.storage.getChannelPatterns();
    this.matcher.buildFromPatterns(patterns, this.storage.normalizeForMatching.bind(this.storage));
    this.patternVersion = version;
  }

  /**
   * Enhance content directly
   */
  async findChannelMatches(content: string, options: EnhancementOptions = {}): Promise<EnhancementResult> {
    await this.initialize();

    // Find all channel matches in content
    const matches = this.matcher.findMatches(content, this.storage.normalizeForMatching.bind(this.storage));
    // Filter matches based on options
    const filteredMatches = this.filterMatches(matches, options);

    return {
      matches: filteredMatches,
    };
  }

  /**
   * Filter matches based on options and quality
   */
  private filterMatches(matches: MatchResult[], options: EnhancementOptions): MatchResult[] {
    const { maxLinksPerChannel = 1 } = options;

    // Sort matches by position (reading order) and content count (quality)
    const sortedMatches = matches
      .sort((a, b) => {
        // Earlier in text first (reading order)
        const positionDiff = a.bestMatch.position - b.bestMatch.position;
        if (positionDiff !== 0) return positionDiff;
        
        // If same position, prefer higher quality
        return b.contents_count - a.contents_count;
      });

    // Filter to only include best matches per channel
    const filteredMatches: MatchResult[] = [];
    const channelCounts = new Map<string, number>();

    for (const match of sortedMatches) {
      const currentCount = channelCounts.get(match.slug) || 0;
      if (currentCount >= maxLinksPerChannel) {
        continue;
      }

      filteredMatches.push(match);
      channelCounts.set(match.slug, currentCount + 1);
    }

    return filteredMatches;
  }





  /**
   * Preview matches without applying enhancements
   */
  async previewMatches(content: string): Promise<MatchResult[]> {
    await this.initialize();
    return this.matcher.findMatches(content, this.storage.normalizeForMatching.bind(this.storage));
  }
}
