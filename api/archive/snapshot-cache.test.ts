import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveCacheKey, SnapshotCache, type CacheOptions } from "@/api/archive/snapshot-cache";

const config = { maxEntries: 2, maxBytes: 8, ttlMs: 1000, concurrency: 2, maxPending: 3, size: (value: string) => value.length };
const directories: string[] = [];
const caches: Array<{ close(): void }> = [];

function persistence() {
  const directory = mkdtempSync(join(tmpdir(), "snapshot-cache-"));
  directories.push(directory);
  return {
    path: join(directory, "snapshots.db"), maxEntries: 10, maxBytes: 1024,
    validate: (value: unknown): value is string => typeof value === "string",
  };
}

function cache(options: Partial<CacheOptions<string>> = {}) {
  const result = new SnapshotCache<string>({ ...config, ...options });
  caches.push(result);
  return result;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Drain promise-only capture/queue continuations without wall-clock sleeps.
async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

afterEach(() => {
  for (const item of caches.splice(0)) item.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("snapshot cache", () => {
  test('rejected admission cannot occupy active or queued capture slots', async () => {
    const subject = cache({ maxPending: 8 });
    const blocked = deferred<string>();
    const busy = ['a', 'b'].map(key => subject.getOrCreate(key, () => blocked.promise));
    let unauthorizedCaptures = 0;
    const denied = Array.from({ length: 6 }, (_, i) => subject.getOrCreate(`denied-${i}`,
      async () => { unauthorizedCaptures++; return 'bad'; },
      () => { throw new Error('Admission denied'); }).catch(error => error.message));
    const legitimate = subject.getOrCreate('legitimate', async () => 'ok');
    expect(await Promise.all(denied)).toEqual(Array(6).fill('Admission denied'));
    blocked.resolve('done');
    await Promise.all(busy);
    expect(await legitimate).toBe('ok');
    expect(unauthorizedCaptures).toBe(0);
  });

  test('hits and coalesced readers do not require a capture admission', async () => {
    const subject = cache();
    const blocked = deferred<string>();
    const first = subject.getOrCreate('a', () => blocked.promise);
    const denied = () => { throw new Error('No capture budget'); };
    const coalesced = subject.getOrCreate('a', async () => 'wrong', denied);
    blocked.resolve('page');
    expect(await first).toBe('page');
    expect(await coalesced).toBe('page');
    expect(await subject.getOrCreate('a', async () => 'wrong', denied)).toBe('page');
  });

  test('stale admission failures back off without failing the read or extending expiry', async () => {
    let now = 0;
    const subject = cache({ ttlMs: 10, staleWhileRevalidateMs: 20, refreshCooldownMs: 10, now: () => now });
    await subject.getOrCreate('a', async () => 'old');
    let admissions = 0;
    const denied = () => { admissions++; throw new Error('No capture budget'); };
    now = 11;
    expect(await subject.getOrCreate('a', async () => 'new', denied)).toBe('old');
    now = 12;
    expect(await subject.getOrCreate('a', async () => 'new', denied)).toBe('old');
    expect(admissions).toBe(1);
    now = 30;
    await expect(subject.getOrCreate('a', async () => 'new', denied)).rejects.toThrow('No capture budget');
  });

  test("five identical requests share one job", async () => {
    const subject = cache();
    const capture = deferred<string>();
    let jobs = 0;
    const requests = Array.from({ length: 5 }, () => subject.getOrCreate("page", () => { jobs++; return capture.promise; }));
    expect(jobs).toBe(1);
    capture.resolve("page");
    expect(await Promise.all(requests)).toEqual(Array(5).fill("page"));
  });

  test("bounds concurrency and rejects excess distinct pending jobs", async () => {
    const subject = cache();
    const captures = Array.from({ length: 3 }, () => deferred<string>());
    let active = 0;
    let maximum = 0;
    const jobs = captures.map((capture, i) => subject.getOrCreate(String(i), async () => {
      active++;
      maximum = Math.max(maximum, active);
      try { return await capture.promise; } finally { active--; }
    }));
    expect(active).toBe(2);
    await expect(subject.getOrCreate("excess", async () => "x")).rejects.toMatchObject({ status: 429 });
    captures[0].resolve("a");
    await jobs[0];
    expect(active).toBe(2);
    captures[1].resolve("b");
    captures[2].resolve("c");
    expect(await Promise.all(jobs)).toEqual(["a", "b", "c"]);
    expect(maximum).toBe(2);
  });

  test("failures release slots and cold misses can be retried immediately", async () => {
    const subject = cache({ concurrency: 1 });
    const failed = subject.getOrCreate("a", async () => { throw new Error("failed"); });
    const next = subject.getOrCreate("b", async () => "ok");
    await expect(failed).rejects.toThrow("failed");
    expect(await next).toBe("ok");
    expect(await subject.getOrCreate("a", async () => "retry")).toBe("retry");
  });

  test("memory count eviction is LRU", async () => {
    const subject = cache();
    await subject.getOrCreate("a", async () => "a");
    await subject.getOrCreate("b", async () => "b");
    expect(await subject.getOrCreate("a", async () => "wrong")).toBe("a");
    await subject.getOrCreate("c", async () => "c");
    expect(await subject.getOrCreate("a", async () => "wrong")).toBe("a");
    expect(await subject.getOrCreate("b", async () => "new")).toBe("new");
  });

  test("memory bytes, oversize values, and zero entry limits are enforced", async () => {
    const subject = cache();
    await subject.getOrCreate("a", async () => "aaaaa");
    await subject.getOrCreate("b", async () => "bbbbb");
    expect(await subject.getOrCreate("a", async () => "new")).toBe("new");
    expect(await subject.getOrCreate("big", async () => "123456789")).toBe("123456789");
    expect(await subject.getOrCreate("big", async () => "small")).toBe("small");
    const disabled = cache({ maxEntries: 0 });
    await disabled.getOrCreate("a", async () => "old");
    expect(await disabled.getOrCreate("a", async () => "new")).toBe("new");
    const noBytes = cache({ maxBytes: 0 });
    await noBytes.getOrCreate("a", async () => "old");
    expect(await noBytes.getOrCreate("a", async () => "new")).toBe("new");
  });

  test("default expiry is exact, does not slide on hits, and starts at capture completion", async () => {
    let now = 0;
    const subject = cache({ now: () => now });
    const capture = deferred<string>();
    const initial = subject.getOrCreate("a", () => capture.promise);
    now = 500;
    capture.resolve("old");
    await initial;
    now = 1499;
    expect(await subject.getOrCreate("a", async () => "wrong")).toBe("old");
    now = 1500;
    expect(await subject.getOrCreate("a", async () => "new")).toBe("new");
  });

  test("stale readers return immediately and coalesce a successful refresh", async () => {
    let now = 0;
    const subject = cache({ now: () => now, staleWhileRevalidateMs: 1000 });
    await subject.getOrCreate("a", async () => "old");
    now = 1000;
    const refresh = deferred<string>();
    let jobs = 0;
    const create = () => { jobs++; return refresh.promise; };
    expect(await Promise.all(Array.from({ length: 5 }, () => subject.getOrCreate("a", create)))).toEqual(Array(5).fill("old"));
    expect(jobs).toBe(1);
    now = 1500;
    refresh.resolve("new");
    await settle();
    now = 2499;
    expect(await subject.getOrCreate("a", async () => "wrong")).toBe("new");
  });

  test("failed refresh cooldown does not extend hard expiry", async () => {
    let now = 0;
    const subject = cache({ now: () => now, staleWhileRevalidateMs: 1000, refreshCooldownMs: 600 });
    await subject.getOrCreate("a", async () => "old");
    let jobs = 0;
    const fail = async () => { jobs++; throw new Error("offline"); };
    now = 1000;
    expect(await subject.getOrCreate("a", fail)).toBe("old");
    await settle();
    now = 1599;
    expect(await subject.getOrCreate("a", fail)).toBe("old");
    expect(jobs).toBe(1);
    now = 1600;
    expect(await subject.getOrCreate("a", fail)).toBe("old");
    await settle();
    expect(jobs).toBe(2);
    now = 2000;
    await expect(subject.getOrCreate("a", fail)).rejects.toThrow("offline");
    expect(jobs).toBe(3);
  });

  test("hard-expired readers join in-flight refresh and never receive stale fallback", async () => {
    let now = 0;
    const subject = cache({ now: () => now, staleWhileRevalidateMs: 1000 });
    await subject.getOrCreate("a", async () => "old");
    const refresh = deferred<string>();
    now = 1000;
    expect(await subject.getOrCreate("a", () => refresh.promise)).toBe("old");
    now = 2000;
    let settled = false;
    const expired = subject.getOrCreate("a", async () => "duplicate");
    void expired.then(() => { settled = true; }, () => { settled = true; });
    await settle();
    expect(settled).toBe(false);
    refresh.reject(new Error("refresh failed"));
    await expect(expired).rejects.toThrow("refresh failed");
    expect(await subject.getOrCreate("a", async () => "fresh")).toBe("fresh");
  });

  test("a full queue still serves stale data without admitting another job", async () => {
    let now = 0;
    const subject = cache({ now: () => now, concurrency: 1, maxPending: 1, staleWhileRevalidateMs: 1000 });
    await subject.getOrCreate("a", async () => "old");
    now = 1000;
    const capture = deferred<string>();
    const pending = subject.getOrCreate("busy", () => capture.promise);
    let jobs = 0;
    expect(await subject.getOrCreate("a", async () => { jobs++; return "new"; })).toBe("old");
    expect(jobs).toBe(0);
    capture.resolve("ok");
    await pending;
    expect(await subject.getOrCreate("a", async () => { jobs++; return "new"; })).toBe("old");
    await settle();
    expect(jobs).toBe(1);
  });

  test("size callback failures and invalid measurements do not discard captures", async () => {
    for (const size of [() => { throw new Error("size failed"); }, () => NaN, () => -1, () => Infinity]) {
      const subject = cache({ size });
      expect(await subject.getOrCreate("a", async () => "old")).toBe("old");
      expect(await subject.getOrCreate("a", async () => "new")).toBe("new");
    }
  });

  test("keys include version and rewrite options and ignore only source fragments", () => {
    const key = archiveCacheKey("https://example.com/a#quote", "https://api.henry.ink");
    expect(key).toBe(archiveCacheKey("https://example.com/a", "https://api.henry.ink"));
    expect(key).toBe(JSON.stringify(["archive-v3", "https://example.com/a", "https://api.henry.ink", ""]));
    expect(key).not.toBe(archiveCacheKey("https://example.com/a", "https://other.example"));
    expect(key).not.toBe(archiveCacheKey("https://example.com/a", "https://api.henry.ink", "https://henry.ink"));
    expect(key).not.toBe(archiveCacheKey("https://example.com/a?variant=2", "https://api.henry.ink"));
    expect(key).not.toBe(archiveCacheKey("https://example.com/a", "https://api.henry.ink", undefined, "archive-v2"));
  });
});

describe("persistent snapshot reuse", () => {
  test("reopening the database reuses values without capture and without sliding expiry", async () => {
    let now = 0;
    const disk = persistence();
    const first = cache({ now: () => now, persistence: disk });
    await first.getOrCreate("page", async () => "old");
    first.close();
    const second = cache({ now: () => now, persistence: disk });
    now = 999;
    expect(await second.getOrCreate("page", async () => { throw new Error("must not capture"); })).toBe("old");
    second.close();
    const third = cache({ now: () => now, persistence: disk });
    now = 1000;
    expect(await third.getOrCreate("page", async () => "new")).toBe("new");
  });

  test("persisted stale data respects refresh cooldown and hard expiry across restarts", async () => {
    let now = 0;
    const options = { now: () => now, persistence: persistence(), staleWhileRevalidateMs: 1000, refreshCooldownMs: 5000 };
    const first = cache(options);
    await first.getOrCreate("page", async () => "old");
    first.close();
    now = 1000;
    const second = cache(options);
    let jobs = 0;
    const fail = async () => { jobs++; throw new Error("offline"); };
    expect(await second.getOrCreate("page", fail)).toBe("old");
    await settle();
    expect(jobs).toBe(1);
    second.close();
    now = 1999;
    const third = cache(options);
    expect(await third.getOrCreate("page", fail)).toBe("old");
    expect(jobs).toBe(1);
    third.close();
    now = 2000;
    const fourth = cache(options);
    await expect(fourth.getOrCreate("page", fail)).rejects.toThrow("offline");
    expect(jobs).toBe(2);
    expect(await fourth.getOrCreate("page", async () => "new")).toBe("new");
  });

  test("version and rewrite key changes invalidate persistent reuse", async () => {
    const options = { now: () => 0, persistence: persistence() };
    const oldKey = archiveCacheKey("https://example.com/", "https://api.example", undefined, "archive-v2");
    const first = cache(options);
    await first.getOrCreate(oldKey, async () => "old");
    first.close();
    const second = cache(options);
    const newKey = archiveCacheKey("https://example.com/", "https://api.example", undefined, "archive-v3");
    expect(await second.getOrCreate(newKey, async () => "new")).toBe("new");
    const rewritten = archiveCacheKey("https://example.com/", "https://api.other", undefined, "archive-v3");
    expect(await second.getOrCreate(rewritten, async () => "rewrite")).toBe("rewrite");
    expect(await second.getOrCreate(oldKey, async () => "wrong")).toBe("old");
  });

  test("a changed loaded-value schema or throwing validator forces capture", async () => {
    for (const validate of [(_value: unknown): _value is string => false, (_value: unknown): _value is string => { throw new Error("schema"); }]) {
      const disk = persistence();
      const first = cache({ now: () => 0, persistence: disk });
      await first.getOrCreate("page", async () => "old");
      first.close();
      const second = cache({ now: () => 0, persistence: { ...disk, validate } });
      expect(await second.getOrCreate("page", async () => "new")).toBe("new");
      second.close();
      const third = cache({ now: () => 0, persistence: disk });
      expect(await third.getOrCreate("page", async () => "wrong")).toBe("new");
    }
  });

  test("disk can retain entries that do not fit memory", async () => {
    const subject = cache({ now: () => 0, maxBytes: 1, persistence: persistence() });
    await subject.getOrCreate("page", async () => "large");
    expect(await subject.getOrCreate("page", async () => "wrong")).toBe("large");
  });

  test("refresh cooldown survives eviction and reload while the refresh is pending", async () => {
    let now = 0;
    const subject = cache({
      now: () => now, maxEntries: 1, persistence: persistence(),
      staleWhileRevalidateMs: 1000, refreshCooldownMs: 500,
    });
    await subject.getOrCreate("a", async () => "old");
    now = 1000;
    const refresh = deferred<string>();
    expect(await subject.getOrCreate("a", () => refresh.promise)).toBe("old");
    await subject.getOrCreate("b", async () => "b");
    expect(await subject.getOrCreate("a", async () => "wrong")).toBe("old");
    refresh.reject(new Error("offline"));
    await settle();
    let jobs = 0;
    const create = async () => { jobs++; return "new"; };
    now = 1499;
    expect(await subject.getOrCreate("a", create)).toBe("old");
    await settle();
    expect(jobs).toBe(0);
    now = 1500;
    expect(await subject.getOrCreate("a", create)).toBe("old");
    await settle();
    expect(jobs).toBe(1);
  });

  test("successful refresh replaces both tiers and clears the persisted cooldown", async () => {
    let now = 0;
    const options = { now: () => now, persistence: persistence(), staleWhileRevalidateMs: 1000, refreshCooldownMs: 100 };
    const first = cache(options);
    await first.getOrCreate("a", async () => "old");
    now = 1000;
    await first.getOrCreate("a", async () => { throw new Error("offline"); });
    await settle();
    now = 1100;
    expect(await first.getOrCreate("a", async () => "new")).toBe("old");
    await settle();
    first.close();
    now = 2099;
    const second = cache(options);
    expect(await second.getOrCreate("a", async () => "wrong")).toBe("new");
    now = 2100;
    expect(await second.getOrCreate("a", async () => "latest")).toBe("new");
    await settle();
    expect(await second.getOrCreate("a", async () => "wrong")).toBe("latest");
  });

  test("original-style HTML and rendering metadata round-trip unchanged", async () => {
    const snapshot = {
      fullHTMLContent: '<!doctype html><html lang="en"><body><article>Original</article></body></html>',
      css: '@layer base { :root { --ink: #123; } }',
      htmlAttrs: { lang: "en" }, bodyAttrs: { class: "article" },
      assets: ["https://example.com/font.woff2"],
    };
    const options: CacheOptions<typeof snapshot> = {
      ...config, maxBytes: 1024, now: () => 0,
      size: value => Buffer.byteLength(JSON.stringify(value)),
      persistence: {
        ...persistence(),
        validate: (value: unknown): value is typeof snapshot => JSON.stringify(value) === JSON.stringify(snapshot),
      },
    };
    const first = new SnapshotCache(options);
    caches.push(first);
    await first.getOrCreate("page", async () => snapshot);
    first.close();
    const second = new SnapshotCache(options);
    caches.push(second);
    expect(await second.getOrCreate("page", async () => { throw new Error("must reuse"); })).toEqual(snapshot);
  });

  test("persistence open errors degrade to capture and memory caching", async () => {
    const disk = persistence();
    const subject = cache({ persistence: { ...disk, path: join(disk.path, "missing", "cache.db") } });
    expect(await subject.getOrCreate("page", async () => "fresh")).toBe("fresh");
    expect(await subject.getOrCreate("page", async () => "wrong")).toBe("fresh");
  });
});
