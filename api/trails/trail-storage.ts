/**
 * SQLite storage operations for trails and marks
 * Handles persistence and querying for the Are.na-like system
 */

import { Database } from "bun:sqlite";
import type { Profile, TrailView, MarkView, SubjectView } from "./types";

export interface StoredTrail {
  id: number;
  uri: string;
  name: string;
  description?: string;
  author_did: string;
  created_at: string;
  indexed_at: string;
}

export interface StoredMark {
  id: number;
  uri: string;
  trail_uri: string;
  subject_type: 'strongRef' | 'external';
  subject_uri?: string;
  subject_cid?: string;
  external_url?: string;
  external_title?: string;
  external_description?: string;
  note?: string;
  author_did: string;
  created_at: string;
  indexed_at: string;
}

export interface TrailView extends StoredTrail {
  mark_count: number;
  latest_mark_at?: string;
}

export class TrailStorage {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    // Enable foreign keys and performance optimizations
    this.db.run("PRAGMA foreign_keys = ON");
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA synchronous = NORMAL");
    this.db.run("PRAGMA cache_size = 10000");

    // Trails table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS trails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uri TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        author_did TEXT NOT NULL,
        created_at TEXT NOT NULL,
        indexed_at TEXT NOT NULL
      )
    `);

    // Marks table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS marks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uri TEXT UNIQUE NOT NULL,
        trail_uri TEXT NOT NULL,
        subject_type TEXT NOT NULL CHECK(subject_type IN ('strongRef', 'external')),
        subject_uri TEXT,
        subject_cid TEXT,
        external_url TEXT,
        external_title TEXT,
        external_description TEXT,
        note TEXT,
        author_did TEXT NOT NULL,
        created_at TEXT NOT NULL,
        indexed_at TEXT NOT NULL,
        FOREIGN KEY (trail_uri) REFERENCES trails (uri) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_trails_author ON trails(author_did);
      CREATE INDEX IF NOT EXISTS idx_trails_created_at ON trails(created_at);
      CREATE INDEX IF NOT EXISTS idx_marks_trail ON marks(trail_uri);
      CREATE INDEX IF NOT EXISTS idx_marks_author ON marks(author_did);
      CREATE INDEX IF NOT EXISTS idx_marks_created_at ON marks(created_at);
      CREATE INDEX IF NOT EXISTS idx_marks_subject_type ON marks(subject_type);
    `);

    // Profiles table for caching
    this.db.run(`
      CREATE TABLE IF NOT EXISTS profiles (
        did TEXT PRIMARY KEY,
        handle TEXT NOT NULL,
        display_name TEXT,
        avatar TEXT,
        updated_at TEXT NOT NULL
      )
    `);

    // Create indexes for performance
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_profiles_handle ON profiles(handle);
      CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);
    `);

    console.log("Trail storage schema initialized");
  }

  /**
   * Store a trail record
   */
  async storeTrail(trail: {
    uri: string;
    name: string;
    description?: string;
    author_did: string;
    created_at: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO trails (
        uri, name, description, author_did, created_at, indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      trail.uri,
      trail.name,
      trail.description || null,
      trail.author_did,
      trail.created_at,
      now
    );
  }

  /**
   * Store a mark record
   */
  async storeMark(mark: {
    uri: string;
    trail_uri: string;
    subject_type: 'strongRef' | 'external';
    subject_uri?: string;
    subject_cid?: string;
    external_url?: string;
    external_title?: string;
    external_description?: string;
    note?: string;
    author_did: string;
    created_at: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO marks (
        uri, trail_uri, subject_type, subject_uri, subject_cid,
        external_url, external_title, external_description, note,
        author_did, created_at, indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      mark.uri,
      mark.trail_uri,
      mark.subject_type,
      mark.subject_uri || null,
      mark.subject_cid || null,
      mark.external_url || null,
      mark.external_title || null,
      mark.external_description || null,
      mark.note || null,
      mark.author_did,
      mark.created_at,
      now
    );
  }

  /**
   * Get trail by URI
   */
  getTrail(uri: string): StoredTrail | null {
    const query = `SELECT * FROM trails WHERE uri = ?`;
    return this.db.prepare(query).get(uri) as StoredTrail | null;
  }

  /**
   * Get marks for a trail
   */
  getTrailMarks(trailUri: string, limit = 50, offset = 0): StoredMark[] {
    const query = `
      SELECT * FROM marks 
      WHERE trail_uri = ?
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `;
    return this.db.prepare(query).all(trailUri, limit, offset) as StoredMark[];
  }

  /**
   * Get trails by author
   */
  getTrailsByAuthor(authorDid: string, limit = 20, offset = 0): TrailView[] {
    const query = `
      SELECT 
        t.*,
        COUNT(m.id) as mark_count,
        MAX(m.created_at) as latest_mark_at
      FROM trails t
      LEFT JOIN marks m ON t.uri = m.trail_uri
      WHERE t.author_did = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return this.db.prepare(query).all(authorDid, limit, offset) as TrailView[];
  }

  /**
   * Get recent trails across all authors
   */
  getRecentTrails(limit = 20, offset = 0): TrailView[] {
    const query = `
      SELECT 
        t.*,
        COUNT(m.id) as mark_count,
        MAX(m.created_at) as latest_mark_at
      FROM trails t
      LEFT JOIN marks m ON t.uri = m.trail_uri
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return this.db.prepare(query).all(limit, offset) as TrailView[];
  }

  /**
   * Search trails by name or description
   */
  searchTrails(query: string, limit = 20): TrailView[] {
    const searchQuery = `
      SELECT 
        t.*,
        COUNT(m.id) as mark_count,
        MAX(m.created_at) as latest_mark_at
      FROM trails t
      LEFT JOIN marks m ON t.uri = m.trail_uri
      WHERE t.name LIKE ? OR t.description LIKE ?
      GROUP BY t.id
      ORDER BY mark_count DESC, t.created_at DESC
      LIMIT ?
    `;
    const searchTerm = `%${query}%`;
    return this.db.prepare(searchQuery).all(searchTerm, searchTerm, limit) as TrailView[];
  }

  /**
   * Get trail statistics
   */
  getStats(): {
    total_trails: number;
    total_marks: number;
    total_authors: number;
  } {
    const stats = this.db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM trails) as total_trails,
        (SELECT COUNT(*) FROM marks) as total_marks,
        (SELECT COUNT(DISTINCT author_did) FROM trails) as total_authors
    `).get() as {
      total_trails: number;
      total_marks: number;
      total_authors: number;
    };
    
    return stats;
  }

  /**
   * Delete a trail and all its marks
   */
  deleteTrail(uri: string): void {
    const deleteMarks = this.db.prepare(`DELETE FROM marks WHERE trail_uri = ?`);
    const deleteTrail = this.db.prepare(`DELETE FROM trails WHERE uri = ?`);
    
    const transaction = this.db.transaction(() => {
      deleteMarks.run(uri);
      deleteTrail.run(uri);
    });
    
    transaction();
  }

  /**
   * Delete a mark
   */
  deleteMark(uri: string): void {
    const deleteMark = this.db.prepare(`DELETE FROM marks WHERE uri = ?`);
    deleteMark.run(uri);
  }

  /**
   * Cache profile information
   */
  async storeProfile(profile: Profile): Promise<void> {
    const now = new Date().toISOString();
    
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO profiles (
        did, handle, display_name, avatar, updated_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    insert.run(
      profile.did,
      profile.handle,
      profile.displayName || null,
      profile.avatar || null,
      now
    );
  }

  /**
   * Get cached profile
   */
  getProfile(did: string): Profile | null {
    const query = `SELECT * FROM profiles WHERE did = ?`;
    const result = this.db.prepare(query).get(did) as any;
    
    if (!result) return null;
    
    return {
      did: result.did,
      handle: result.handle,
      displayName: result.display_name || undefined,
      avatar: result.avatar || undefined,
    };
  }

  /**
   * Get trails that contain a specific subject
   */
  getTrailsContaining(subjectUri: string, limit = 20): TrailView[] {
    const query = `
      SELECT DISTINCT t.*, COUNT(m2.id) as mark_count
      FROM trails t
      JOIN marks m ON t.uri = m.trail_uri
      LEFT JOIN marks m2 ON t.uri = m2.trail_uri
      WHERE m.subject_uri = ? OR m.external_url = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT ?
    `;
    
    const results = this.db.prepare(query).all(subjectUri, subjectUri, limit) as any[];
    return results.map(this.mapToTrailView.bind(this));
  }

  /**
   * Search trails by name or description
   */
  searchTrails(query: string, limit = 20): TrailView[] {
    const searchQuery = `
      SELECT 
        t.*,
        COUNT(m.id) as mark_count
      FROM trails t
      LEFT JOIN marks m ON t.uri = m.trail_uri
      WHERE t.name LIKE ? OR (t.description IS NOT NULL AND t.description LIKE ?)
      GROUP BY t.id
      ORDER BY mark_count DESC, t.created_at DESC
      LIMIT ?
    `;
    const searchTerm = `%${query}%`;
    const results = this.db.prepare(searchQuery).all(searchTerm, searchTerm, limit) as any[];
    return results.map(this.mapToTrailView.bind(this));
  }

  /**
   * Map database row to TrailView
   */
  private mapToTrailView(row: any): TrailView {
    const creator = this.getProfile(row.author_did);
    
    return {
      uri: row.uri,
      cid: '', // Would need to be provided from firehose
      name: row.name,
      description: row.description || undefined,
      creator: creator || {
        did: row.author_did,
        handle: row.author_did.slice(-8) + '...',
      },
      markCount: row.mark_count || 0,
      indexedAt: row.indexed_at,
      createdAt: row.created_at,
    };
  }

  /**
   * Map database row to MarkView
   */
  private mapToMarkView(row: any): MarkView {
    const creator = this.getProfile(row.author_did);
    const trail = this.getTrail(row.trail_uri);
    
    const subject: SubjectView = {
      type: row.subject_type,
    };

    if (row.subject_type === 'strongRef') {
      subject.uri = row.subject_uri;
      subject.cid = row.subject_cid;
    } else {
      subject.url = row.external_url;
      subject.title = row.external_title || undefined;
      subject.description = row.external_description || undefined;
    }

    return {
      uri: row.uri,
      cid: '', // Would need to be provided from firehose
      trail: trail ? this.mapToTrailView(trail) : {
        uri: row.trail_uri,
        cid: '',
        name: 'Unknown Trail',
        creator: { did: 'unknown', handle: 'unknown' },
        markCount: 0,
        indexedAt: '',
        createdAt: '',
      },
      subject,
      note: row.note || undefined,
      creator: creator || {
        did: row.author_did,
        handle: row.author_did.slice(-8) + '...',
      },
      indexedAt: row.indexed_at,
      createdAt: row.created_at,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}