import { Database } from "bun:sqlite";

export interface SnapshotPersistenceOptions {
  /** Dedicated SQLite file. Its parent directory must already exist. */
  path: string;
  maxEntries: number;
  /** UTF-8 JSON payload plus key bytes, excluding SQLite page/index overhead. */
  maxBytes: number;
}

export interface PersistedSnapshot {
  value: unknown;
  freshUntil: number;
  expires: number;
  retryAt: number;
}

interface Row {
  payload: string;
  freshUntil: number;
  expires: number;
  retryAt: number;
}

function validTimes(entry: Omit<PersistedSnapshot, "value">): boolean {
  return [entry.freshUntil, entry.expires, entry.retryAt].every(Number.isFinite)
    && entry.freshUntil <= entry.expires && entry.retryAt >= 0;
}

/** Best-effort, synchronous storage. Database failures disable persistence, not capture. */
export class SnapshotPersistence {
  private db?: Database;
  private disabled = false;

  constructor(private options: SnapshotPersistenceOptions) {
    if (!Number.isInteger(options.maxEntries) || options.maxEntries < 0
      || !Number.isFinite(options.maxBytes) || options.maxBytes < 0) {
      throw new RangeError("Persistence limits must be finite and nonnegative; maxEntries must be an integer");
    }
  }

  private withDatabase<T>(action: (db: Database) => T): T | undefined {
    if (this.disabled) return;
    try {
      if (!this.db) {
        this.db = new Database(this.options.path, { create: true });
        this.db.exec(`
          PRAGMA busy_timeout = 50;
          PRAGMA auto_vacuum = FULL;
          CREATE TABLE IF NOT EXISTS snapshots_v1 (
            key TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            bytes INTEGER NOT NULL CHECK (bytes >= 0),
            freshUntil REAL NOT NULL,
            expires REAL NOT NULL,
            retryAt REAL NOT NULL,
            accessed INTEGER NOT NULL
          );
        `);
      }
      return action(this.db);
    } catch {
      this.close();
    }
  }

  close(): void {
    this.disabled = true;
    try { this.db?.close(); } catch { /* Best effort after an I/O failure. */ }
    this.db = undefined;
  }

  private prune(db: Database, now: number): void {
    db.query("DELETE FROM snapshots_v1 WHERE expires <= ?").run(now);
    const totals = db.query<{ count: number; bytes: number }, []>(
      "SELECT COUNT(*) AS count, COALESCE(SUM(bytes), 0) AS bytes FROM snapshots_v1",
    ).get()!;
    if (totals.count <= this.options.maxEntries && totals.bytes <= this.options.maxBytes) return;
    const oldest = db.query<{ key: string; bytes: number }, []>(
      "SELECT key, bytes FROM snapshots_v1 ORDER BY accessed, key",
    ).all();
    for (const row of oldest) {
      if (totals.count <= this.options.maxEntries && totals.bytes <= this.options.maxBytes) break;
      db.query("DELETE FROM snapshots_v1 WHERE key = ?").run(row.key);
      totals.count--;
      totals.bytes -= row.bytes;
    }
  }

  get(key: string, now: number): PersistedSnapshot | undefined {
    return this.withDatabase(db => db.transaction(() => {
      // Also enforces smaller limits when reopening an existing database.
      this.prune(db, now);
      const row = db.query<Row, [string]>("SELECT payload, freshUntil, expires, retryAt FROM snapshots_v1 WHERE key = ?").get(key);
      if (!row) return;
      try {
        if (!validTimes(row)) throw new Error("Invalid snapshot timestamps");
        const value: unknown = JSON.parse(row.payload);
        db.query("UPDATE snapshots_v1 SET accessed = (SELECT COALESCE(MAX(accessed), 0) + 1 FROM snapshots_v1) WHERE key = ?").run(key);
        return { value, freshUntil: row.freshUntil, expires: row.expires, retryAt: row.retryAt };
      } catch {
        db.query("DELETE FROM snapshots_v1 WHERE key = ?").run(key);
      }
    })());
  }

  set(key: string, entry: PersistedSnapshot, now: number): void {
    this.withDatabase(db => db.transaction(() => {
      // A successful but uncacheable replacement must not resurrect its previous snapshot.
      db.query("DELETE FROM snapshots_v1 WHERE key = ?").run(key);
      let payload: string | undefined;
      try { payload = JSON.stringify(entry.value); } catch { /* Non-JSON values are not persisted. */ }
      if (payload !== undefined && validTimes(entry) && entry.expires > now) {
        const bytes = Buffer.byteLength(key) + Buffer.byteLength(payload);
        if (this.options.maxEntries > 0 && bytes <= this.options.maxBytes) {
          db.query(`INSERT INTO snapshots_v1 (key, payload, bytes, freshUntil, expires, retryAt, accessed)
            VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(accessed), 0) + 1 FROM snapshots_v1))`)
            .run(key, payload, bytes, entry.freshUntil, entry.expires, entry.retryAt);
        }
      }
      this.prune(db, now);
    })());
  }

  delete(key: string): void {
    this.withDatabase(db => { db.query("DELETE FROM snapshots_v1 WHERE key = ?").run(key); });
  }

  deferRefresh(key: string, expires: number, retryAt: number): void {
    this.withDatabase(db => {
      db.query("UPDATE snapshots_v1 SET retryAt = ? WHERE key = ? AND expires = ?").run(retryAt, key, expires);
    });
  }
}
