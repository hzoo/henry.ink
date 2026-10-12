import { describe, expect, test } from "bun:test";
import { archiveCacheKey, SnapshotCache } from "@/api/archive/snapshot-cache";

const config = { maxEntries: 2, maxBytes: 8, ttlMs: 1000, concurrency: 2, maxPending: 3, size: (value: string) => value.length };
describe("snapshot cache", () => {
  test("five identical requests share one job", async () => {
    const cache = new SnapshotCache<string>(config);
    let jobs = 0;
    const create = async () => { jobs++; await Bun.sleep(10); return "page"; };
    expect(await Promise.all(Array.from({ length: 5 }, () => cache.getOrCreate("page", create)))).toEqual(Array(5).fill("page"));
    expect(jobs).toBe(1);
  });

  test("bounds concurrency and rejects excess distinct pending jobs", async () => {
    const cache = new SnapshotCache<string>(config);
    let active = 0;
    let maximum = 0;
    const create = async () => { active++; maximum = Math.max(maximum, active); await Bun.sleep(10); active--; return "x"; };
    const jobs = ["a", "b", "c"].map(key => cache.getOrCreate(key, create));
    await expect(cache.getOrCreate("d", create)).rejects.toMatchObject({ status: 429 });
    await Promise.all(jobs);
    expect(maximum).toBe(2);
  });

  test("failures release slots and can be retried", async () => {
    const cache = new SnapshotCache<string>({ ...config, concurrency: 1 });
    const failed = cache.getOrCreate("a", async () => { throw new Error("failed"); });
    const next = cache.getOrCreate("b", async () => "ok");
    await expect(failed).rejects.toThrow("failed");
    expect(await next).toBe("ok");
    expect(await cache.getOrCreate("a", async () => "retry")).toBe("retry");
  });

  test("evicts by bytes and expires snapshots", async () => {
    const cache = new SnapshotCache<string>({ ...config, ttlMs: 10 });
    await cache.getOrCreate("a", async () => "aaaaa");
    await cache.getOrCreate("b", async () => "bbbbb");
    expect(await cache.getOrCreate("a", async () => "new")).toBe("new");
    await Bun.sleep(15);
    expect(await cache.getOrCreate("a", async () => "fresh")).toBe("fresh");
  });

  test("keys include rewrite options and ignore source fragments", () => {
    const key = archiveCacheKey("https://example.com/a#quote", "https://api.henry.ink");
    expect(key).toBe(archiveCacheKey("https://example.com/a", "https://api.henry.ink"));
    expect(key).not.toBe(archiveCacheKey("https://example.com/a", "https://other.example"));
    expect(key).not.toBe(archiveCacheKey("https://example.com/a", "https://api.henry.ink", "https://henry.ink"));
  });
});
