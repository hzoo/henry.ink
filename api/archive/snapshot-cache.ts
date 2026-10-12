import { ArchiveFetchError } from "@/api/archive/public-fetch";

interface CacheOptions<T> {
  maxEntries: number;
  maxBytes: number;
  ttlMs: number;
  concurrency: number;
  maxPending: number;
  size: (value: T) => number;
}

export class SnapshotCache<T> {
  private cache = new Map<string, { value: T; bytes: number; expires: number }>();
  private pending = new Map<string, Promise<T>>();
  private waiting: Array<() => void> = [];
  private active = 0;
  private bytes = 0;

  constructor(private options: CacheOptions<T>) {}

  private remove(key: string): void {
    const entry = this.cache.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.cache.delete(key);
  }

  async getOrCreate(key: string, create: () => Promise<T>): Promise<T> {
    for (const [key, entry] of this.cache) if (entry.expires <= Date.now()) this.remove(key);
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached.value;
    }
    const existing = this.pending.get(key);
    if (existing) return existing;
    if (this.pending.size >= this.options.maxPending) throw new ArchiveFetchError("Archive queue is full", 429);
    const job = this.run(create);
    this.pending.set(key, job);
    try {
      const value = await job;
      const bytes = this.options.size(value);
      if (bytes <= this.options.maxBytes) {
        while (this.cache.size >= this.options.maxEntries || this.bytes + bytes > this.options.maxBytes) {
          const oldest = this.cache.keys().next().value;
          if (oldest === undefined) break;
          this.remove(oldest);
        }
        this.cache.set(key, { value, bytes, expires: Date.now() + this.options.ttlMs });
        this.bytes += bytes;
      }
      return value;
    } finally { this.pending.delete(key); }
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

export function archiveCacheKey(url: string, assetBase: string, linkBase?: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return JSON.stringify(["archive-v2", parsed.href, assetBase, linkBase || ""]);
}
