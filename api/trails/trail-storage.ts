/**
 * SQLite storage operations for trails and marks
 * Handles persistence and querying for the Are.na-like system
 */

import { Database } from "bun:sqlite";
import type { Profile } from "./types";

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
  note?: string;
  author_did: string;
  created_at: string;
  indexed_at: string;
}

export interface StoredTrailView extends StoredTrail {
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
    this.db.run("PRAGMA temp_store = MEMORY");
    this.db.run("PRAGMA mmap_size = 30000000");

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
      CREATE INDEX IF NOT EXISTS idx_trails_created_at ON trails(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_marks_trail ON marks(trail_uri);
      CREATE INDEX IF NOT EXISTS idx_marks_trail_created ON marks(trail_uri, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_marks_author ON marks(author_did);
      CREATE INDEX IF NOT EXISTS idx_marks_subject ON marks(subject_uri);
      CREATE INDEX IF NOT EXISTS idx_marks_external_url ON marks(external_url);
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
  storeTrail(trail: {
    uri: string;
    name: string;
    description?: string;
    author_did: string;
    created_at: string;
  }): void {
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
  storeMark(mark: {
    uri: string;
    trail_uri: string;
    subject_type: 'strongRef' | 'external';
    subject_uri?: string;
    subject_cid?: string;
    external_url?: string;
    external_title?: string;
    note?: string;
    author_did: string;
    created_at: string;
  }): void {
    const now = new Date().toISOString();
    
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO marks (
        uri, trail_uri, subject_type, subject_uri, subject_cid,
        external_url, external_title, note,
        author_did, created_at, indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      mark.uri,
      mark.trail_uri,
      mark.subject_type,
      mark.subject_uri || null,
      mark.subject_cid || null,
      mark.external_url || null,
      mark.external_title || null,
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
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return this.db.prepare(query).all(trailUri, limit, offset) as StoredMark[];
  }

  /**
   * Get trails by author
   */
  getTrailsByAuthor(authorDid: string, limit = 20, offset = 0): StoredTrailView[] {
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
    return this.db.prepare(query).all(authorDid, limit, offset) as StoredTrailView[];
  }

  /**
   * Get recent trails across all authors
   */
  getRecentTrails(limit = 20, offset = 0): StoredTrailView[] {
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
    return this.db.prepare(query).all(limit, offset) as StoredTrailView[];
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
  storeProfile(profile: Profile): void {
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
  getTrailsContaining(subjectUri: string, limit = 20, authorDid?: string): StoredTrailView[] {
    let query = `
      SELECT t.*, 
        COUNT(m.id) as mark_count,
        MAX(m.created_at) as latest_mark_at
      FROM trails t
      JOIN marks m ON t.uri = m.trail_uri
      WHERE (m.subject_uri = ? OR m.external_url = ?)
    `;
    
    const params: (string | number)[] = [subjectUri, subjectUri];
    
    if (authorDid) {
      query += ` AND t.author_did = ?`;
      params.push(authorDid);
    }
    
    query += `
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT ?
    `;
    params.push(limit);
    
    const results = this.db.prepare(query).all(...params) as StoredTrailView[];
    return results;
  }

  /**
   * Search trails by name or description
   */
  searchTrails(query: string, limit = 20): StoredTrailView[] {
    const searchQuery = `
      SELECT 
        t.*,
        COUNT(m.id) as mark_count
      FROM trails t
      LEFT JOIN marks m ON t.uri = m.trail_uri
      WHERE t.name LIKE ?
      GROUP BY t.id
      ORDER BY mark_count DESC, t.created_at DESC
      LIMIT ?
    `;
    const searchTerm = `%${query}%`;
    const results = this.db.prepare(searchQuery).all(searchTerm, limit) as StoredTrailView[];
    return results;
  }


  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}