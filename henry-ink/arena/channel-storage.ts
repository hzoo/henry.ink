/**
 * SQLite storage operations for Arena channels
 * Handles persistence, querying, and pattern preparation
 */

import { Database } from "bun:sqlite";
import type { ArenaChannel } from "./arena-client.ts";

export interface StoredChannel {
  id: number;
  slug: string;
  title: string;
  author_name: string;
  author_slug?: string;
  contents_count: number;
  last_checked: string;
  created_at: string;
  updated_at: string;
}

export interface ChannelPattern {
  text: string;
  slug: string;
  title: string;
  author_name: string;
  author_slug?: string;
  contents_count: number;
  updated_at: string;
}

export class ChannelStorage {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    // Enable foreign keys and performance optimizations
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = NORMAL");
    this.db.exec("PRAGMA cache_size = 10000");

    // Main channels table - simplified schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        author_name TEXT,
        contents_count INTEGER NOT NULL DEFAULT 0,
        last_checked TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      )
    `);

    // Add author_slug column if it doesn't exist (for existing databases)
    try {
      this.db.exec(`ALTER TABLE channels ADD COLUMN author_slug TEXT`);
      console.log('✅ Added author_slug column to existing database');
    } catch (error) {
      // Column already exists, ignore error
    }

    // Metadata table for sync tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_channels_contents ON channels(contents_count) WHERE contents_count > 0;
      CREATE INDEX IF NOT EXISTS idx_channels_slug ON channels(slug);
      CREATE INDEX IF NOT EXISTS idx_channels_title ON channels(title);
    `);

    console.log("Database schema initialized");
  }

  /**
   * Store channels in bulk with transaction for performance
   */
  async storeChannels(channels: ArenaChannel[]): Promise<void> {
    if (channels.length === 0) return;

    const now = new Date().toISOString();
    
    // Build bulk INSERT with multiple VALUES
    const placeholders = channels.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const bulkInsert = this.db.prepare(`
      INSERT OR REPLACE INTO channels (
        id, slug, title, author_name, author_slug, contents_count, last_checked, created_at, updated_at
      ) VALUES ${placeholders}
    `);

    // Flatten all channel data into a single array
    const values: (string | number | null)[] = [];
    for (const channel of channels) {
      values.push(
        channel.id,
        channel.slug,
        channel.title,
        channel.author_name || 'unknown',
        channel.author_slug || null,
        channel.counts.contents,
        now,
        channel.created_at,
        channel.updated_at
      );
    }

    const transaction = this.db.transaction(() => {
      bulkInsert.run(...values);
    });

    console.log(`Storing ${channels.length} channels...`);
    transaction();

    // Update sync metadata
    this.db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
      VALUES ('last_sync', ?, ?)
    `).run(now, now);

    console.log(`Stored ${channels.length} channels successfully`);
  }

  /**
   * Save sync progress to a metadata table
   */
  saveSyncProgress(apiType: string = 'graphql', page: number, totalChannels: number, timestamp: string = new Date().toISOString()): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
      VALUES (?, ?, ?)
    `);

    insert.run(`${apiType}_sync_page`, page.toString(), timestamp);
    insert.run(`${apiType}_sync_total_channels`, totalChannels.toString(), timestamp);
    
    console.log(`📊 ${apiType.toUpperCase()} Progress saved: page ${page}, ${totalChannels} channels total`);
  }

  /**
   * Clear sync progress (for fresh start)
   */
  clearSyncProgress(): void {
    this.db.prepare(`DELETE FROM sync_metadata WHERE key IN ('sync_page', 'sync_total_channels')`).run();
    console.log('🗑️ Cleared sync progress - starting fresh');
  }

  /**
   * Get the last sync progress for specific API type
   */
  getLastSyncProgress(apiType: string = 'graphql'): { page: number; totalChannels: number; timestamp: string } | null {
    try {
      const pageQuery = this.db.prepare(`
        SELECT value, updated_at FROM sync_metadata WHERE key = ?
      `);
      const totalQuery = this.db.prepare(`
        SELECT value FROM sync_metadata WHERE key = ?
      `);
      
      const pageResult = pageQuery.get(`${apiType}_sync_page`) as any;
      const totalResult = totalQuery.get(`${apiType}_sync_total_channels`) as any;
      
      if (pageResult && totalResult) {
        return {
          page: parseInt(pageResult.value),
          totalChannels: parseInt(totalResult.value),
          timestamp: pageResult.updated_at
        };
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get all patterns for Aho-Corasick trie building
   * Focus on multi-word patterns with cleaned titles
   */
  getChannelPatterns(): ChannelPattern[] {
    const query = `
      SELECT 
        title as text,
        slug,
        title,
        author_name,
        author_slug,
        contents_count,
        updated_at
      FROM channels
      WHERE contents_count >= 3
      ORDER BY contents_count DESC
    `;

    const channels = this.db.prepare(query).all() as ChannelPattern[];
    const patterns: ChannelPattern[] = [];
    
    console.log(`🏗️ Processing ${channels.length} channels for pattern generation`);
    
    for (const channel of channels) {
      // Clean the channel title
      const cleanedTitles = this.cleanChannelTitle(channel.title);
      
      // Create patterns for each cleaned version
      for (const cleanedTitle of cleanedTitles) {
        // Only include multi-word patterns (2+ words)
        const wordCount = cleanedTitle.split(' ').length;
        if (wordCount >= 2) {
          patterns.push({
            text: cleanedTitle,  // Use cleaned text for matching
            slug: channel.slug,
            title: channel.title, // Keep original title for display
            author_name: channel.author_name,
            author_slug: channel.author_slug,
            contents_count: channel.contents_count,
            updated_at: channel.updated_at
          });
        }
      }
    }

    console.log(`📊 Generated ${patterns.length} multi-word patterns from ${channels.length} channels`);
    
    return patterns;
  }

  /**
   * Clean Arena channel titles to extract meaningful text
   * Removes emojis, special characters, and decorative elements
   */
  cleanChannelTitle(title: string): string[] {
    // Remove emoji and special Unicode characters (comprehensive range)
    let cleaned = title.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F910}-\u{1F96B}]|[\u{1F980}-\u{1F9E0}]/gu, '');
    
    // Remove quotes and apostrophes
    cleaned = cleaned.replace(/['""`''""]/g, '');
    
    // Remove brackets and their contents
    cleaned = cleaned.replace(/\[[^\]]*\]/g, ''); // Remove [stuff]
    
    // Remove parentheses and their contents if at start/end
    cleaned = cleaned.replace(/^\([^)]*\)\s*/, ''); // Remove (stuff) at start
    cleaned = cleaned.replace(/\s*\([^)]*\)$/, ''); // Remove (stuff) at end
    
    // Split on slashes to handle alternatives
    const parts = cleaned.split('/').map(part => part.trim()).filter(part => part.length > 0);
    
    // Clean up each part
    const cleanedParts = parts.map(part => {
      return part
        .replace(/\s+/g, ' ')  // Collapse multiple spaces
        .replace(/^\W+|\W+$/g, '') // Remove leading/trailing non-word chars
        .trim()
        .toLowerCase();
    });
    
    // Return all meaningful parts (could be multiple if separated by /)
    return cleanedParts.filter(part => part.length >= 3 && /[a-zA-Z]/.test(part)); // Min 3 chars with letters
  }

  /**
   * Normalize text for consistent matching
   * Simple lowercase normalization with HTML entity decoding
   */
  normalizeForMatching(text: string): string {
    // Decode HTML entities first
    const decoded = this.decodeHtmlEntities(text);
    return decoded.toLowerCase().trim();
  }

  /**
   * Decode HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    const entityMap: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&nbsp;': ' ',
      '&#x27;': "'",
      '&#x2F;': '/'
    };
    
    return text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => {
      return entityMap[entity] || entity;
    });
  }

  /**
   * Debug normalization: show examples of how text gets normalized
   * Useful for understanding why patterns might not match
   */
  debugNormalization(sampleTexts: string[] = []): void {
    // Use provided samples or get some from our channel titles
    let textsToTest = sampleTexts;
    
    if (textsToTest.length === 0) {
      // Get a sample of channel titles for testing
      const sampleChannels = this.db.prepare(`
        SELECT title FROM channels 
        WHERE contents_count >= 3 
        ORDER BY contents_count DESC 
        LIMIT 20
      `).all() as { title: string }[];
      
      textsToTest = sampleChannels.map(c => c.title);
    }
    
    console.group('🔍 Normalization Debug');
    console.log('Examples of text normalization:');
    
    for (const text of textsToTest.slice(0, 10)) {
      const normalized = this.normalizeForMatching(text);
      const cleaned = this.cleanChannelTitle(text);
      
      console.log(`  "${text}"`);
      console.log(`    → normalized: "${normalized}"`);
      console.log(`    → cleaned: [${cleaned.join(', ')}]`);
      console.log('');
    }
    
    console.groupEnd();
  }


  /**
   * Get channel info by slug for link generation
   */
  getChannelBySlug(slug: string): StoredChannel | null {
    const query = `
      SELECT * FROM channels WHERE slug = ? AND contents_count >= 3
    `;
    
    return this.db.prepare(query).get(slug) as StoredChannel | null;
  }

  /**
   * Get channels by multiple slugs efficiently
   */
  getChannelsBySlug(slugs: string[]): StoredChannel[] {
    if (slugs.length === 0) return [];
    
    const placeholders = slugs.map(() => '?').join(',');
    const query = `
      SELECT * FROM channels 
      WHERE slug IN (${placeholders}) AND contents_count >= 3
    `;
    
    return this.db.prepare(query).all(...slugs) as StoredChannel[];
  }

  /**
   * Remove a channel by slug (for dead/404 channels)
   */
  removeChannelBySlug(slug: string): void {
    const result = this.db.prepare(`DELETE FROM channels WHERE slug = ?`).run(slug);
    if (result.changes > 0) {
      console.log(`🗑️ Removed dead channel: ${slug}`);
    }
  }

  /**
   * Update author information for a channel (lazy loading)
   */
  updateChannelAuthor(slug: string, authorName: string, authorSlug?: string): void {
    const update = this.db.prepare(`
      UPDATE channels 
      SET author_name = ?, author_slug = ?, last_checked = ? 
      WHERE slug = ?
    `);
    
    const result = update.run(authorName, authorSlug || null, new Date().toISOString(), slug);
    if (result.changes > 0) {
      console.log(`📝 Updated author for ${slug}: ${authorName} (@${authorSlug})`);
    }
  }



  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}