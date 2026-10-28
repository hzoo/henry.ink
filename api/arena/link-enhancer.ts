/**
 * Wikipedia-style link enhancer with context awareness
 * Main orchestration for enhancing content with Arena channel links
 */

import type { ChannelStorage } from '@/api/arena/channel-storage';
import type { ChannelPatternMatcher, MatchResult } from '@/api/arena/pattern-matcher';

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
  async findChannelMatches(content: string): Promise<EnhancementResult> {
    await this.initialize();

    // Find all channel matches in content
    const matches = this.matcher.findMatches(content, this.storage.normalizeForMatching.bind(this.storage));
    // The matcher already selects one result per channel; show them in reading order.
    matches.sort((a, b) => a.bestMatch.position - b.bestMatch.position
      || b.contents_count - a.contents_count);
    return { matches };
  }
}
