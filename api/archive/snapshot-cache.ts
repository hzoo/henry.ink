import { ArchiveFetchError } from "@/api/archive/public-fetch";
import { SnapshotPersistence, type SnapshotPersistenceOptions } from "@/api/archive/snapshot-persistence";

export interface CacheOptions<T> {
  maxEntries: number;
  maxBytes: number;
  ttlMs: number;
  concurrency: number;
  maxPending: number;
  size: (value: T) => number;
  /** Additional time after ttlMs during which stale results may be served. Defaults to 0. */
  staleWhileRevalidateMs?: number;
  /** Delay after a failed background refresh. Defaults to 30 seconds; never extends expiry. */
  refreshCooldownMs?: number;
  now?: () => number;
  /** Values must round-trip through JSON. Validate the current schema before reuse. */
  persistence?: SnapshotPersistenceOptions & { validate: (value: unknown) => value is T };
}

interface Entry<T> {
  value: T;
  bytes: number;
  freshUntil: number;
  expires: number;
  retryAt: number;
}

export class SnapshotCache<T> {
  private cache = new Map<string, Entry<T>>();
  private pending = new Map<string, Promise<T>>();
  private waiting: Array<() => void> = [];
  private active = 0;
  private bytes = 0;
  private readonly now: () => number;
  private readonly staleMs: number;
  private readonly cooldownMs: number;
  private readonly persistence?: SnapshotPersistence;

  constructor(private options: CacheOptions<T>) {
    this.now = options.now ?? Date.now;
    this.staleMs = options.staleWhileRevalidateMs ?? 0;
    this.cooldownMs = options.refreshCooldownMs ?? 30_000;
    for (const value of [options.maxEntries, options.maxBytes, options.ttlMs, this.staleMs, this.cooldownMs]) {
      if (!Number.isFinite(value) || value < 0) throw new RangeError("Cache limits must be finite and nonnegative");
    }
    for (const value of [options.concurrency, options.maxPending]) {
      if (!Number.isInteger(value) || value < 1) throw new RangeError("Cache queue limits must be positive integers");
    }
    if (!Number.isInteger(options.maxEntries)) throw new RangeError("maxEntries must be an integer");
    if (options.persistence) this.persistence = new SnapshotPersistence(options.persistence);
  }

  private remove(key: string): void {
    const entry = this.cache.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.cache.delete(key);
  }

  async getOrCreate(key: string, create: () => Promise<T>, admit?: () => void): Promise<T> {
    const now = this.now();
    for (const [key, entry] of this.cache) if (entry.expires <= now) this.remove(key);
    const cached = this.cache.get(key) ?? this.load(key, now);
    if (cached) {
      if (this.cache.has(key)) {
        this.cache.delete(key);
        this.cache.set(key, cached);
      }
      if (cached.freshUntil <= now && cached.retryAt <= now && !this.pending.has(key)
        && this.pending.size < this.options.maxPending) {
        // Stale readers never wait for refresh, and rejected refreshes are always observed.
        void this.start(key, create, cached, admit).catch(() => {});
      }
      return cached.value;
    }
    const existing = this.pending.get(key);
    if (existing) return existing;
    if (this.pending.size >= this.options.maxPending) throw new ArchiveFetchError("Archive queue is full", 429);
    return this.start(key, create, undefined, admit);
  }

  /** Release the database handle. The cache can continue operating in memory. */
  close(): void {
    this.persistence?.close();
  }

  private load(key: string, now: number): Entry<T> | undefined {
    const stored = this.persistence?.get(key, now);
    if (!stored) return;
    try {
      if (this.options.persistence?.validate(stored.value)) {
        const entry = { ...stored, value: stored.value, bytes: this.measure(stored.value) };
        this.remember(key, entry);
        return entry;
      }
    } catch { /* Invalid or incompatible persisted data is a miss. */ }
    this.persistence?.delete(key);
  }

  private measure(value: T): number {
    const bytes = this.options.size(value);
    if (!Number.isFinite(bytes) || bytes < 0) throw new RangeError("Invalid snapshot size");
    return bytes;
  }

  private remember(key: string, entry: Entry<T>): void {
    this.remove(key);
    if (this.options.maxEntries === 0 || entry.bytes > this.options.maxBytes) return;
    while (this.cache.size >= this.options.maxEntries || this.bytes + entry.bytes > this.options.maxBytes) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.remove(oldest);
    }
    this.cache.set(key, entry);
    this.bytes += entry.bytes;
  }

  private deferRefresh(key: string, stale?: Entry<T>): void {
    if (!stale) return;
    stale.retryAt = Math.min(stale.expires, this.now() + this.cooldownMs);
    // Eviction and a disk reload can replace the entry during capture.
    const current = this.cache.get(key);
    if (current?.expires === stale.expires) current.retryAt = stale.retryAt;
    this.persistence?.deferRefresh(key, stale.expires, stale.retryAt);
  }

  private start(key: string, create: () => Promise<T>, stale?: Entry<T>, admit?: () => void): Promise<T> {
    // Admission follows hits/coalescing, but precedes any shared queue reservation.
    try { admit?.(); }
    catch (error) {
      this.deferRefresh(key, stale);
      return Promise.reject(error);
    }
    const job = this.run(create).then(value => {
      const freshUntil = this.now() + this.options.ttlMs;
      const entry = { value, freshUntil, expires: freshUntil + this.staleMs, retryAt: 0 };
      this.remove(key);
      try {
        this.remember(key, { ...entry, bytes: this.measure(value) });
      } catch { /* Cache bookkeeping must not discard a successful capture. */ }
      this.persistence?.set(key, entry, this.now());
      return value;
    }, error => {
      this.deferRefresh(key, stale);
      throw error;
    }).finally(() => { this.pending.delete(key); });
    this.pending.set(key, job);
    return job;
  }

  private async run(create: () => Promise<T>): Promise<T> {
    if (this.active >= this.options.concurrency) await new Promise<void>(resolve => this.waiting.push(resolve));
    else this.active++;
    try { return await create(); }
    finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}

/** Bump version whenever capture, sanitization, or rewriting semantics change. */
export function archiveCacheKey(url: string, assetBase: string, linkBase?: string, version = "archive-v4"): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return JSON.stringify([version, parsed.href, assetBase, linkBase || ""]);
}
