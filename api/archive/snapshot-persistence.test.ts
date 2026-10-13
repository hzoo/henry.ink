import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SnapshotPersistence, type PersistedSnapshot } from "@/api/archive/snapshot-persistence";

const directories: string[] = [];
const stores: SnapshotPersistence[] = [];

function fixture(limits = { maxEntries: 2, maxBytes: 100 }) {
  const directory = mkdtempSync(join(tmpdir(), "snapshot-persistence-"));
  directories.push(directory);
  const options = { path: join(directory, "snapshots.db"), ...limits };
  const store = new SnapshotPersistence(options);
  stores.push(store);
  return { store, options };
}

function entry(value: unknown, expires = 2000): PersistedSnapshot {
  return { value, freshUntil: 1000, expires, retryAt: 0 };
}

afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("snapshot persistence", () => {
  test("count eviction is deterministic LRU even when the clock does not advance", () => {
    const { store } = fixture();
    store.set("a", entry("a"), 0);
    store.set("b", entry("b"), 0);
    expect(store.get("a", 0)?.value).toBe("a");
    store.set("c", entry("c"), 0);
    expect(store.get("b", 0)).toBeUndefined();
    expect(store.get("a", 0)?.value).toBe("a");
    expect(store.get("c", 0)?.value).toBe("c");
  });

  test("byte bounds include UTF-8 keys and serialized payloads, not JS string lengths", () => {
    const { store } = fixture({ maxEntries: 10, maxBytes: 8 });
    store.set("a", entry("aaa"), 0); // 1 key byte + 5 JSON bytes.
    store.set("b", entry("b"), 0); // 1 + 3; evicts a.
    expect(store.get("a", 0)).toBeUndefined();
    store.set("c", entry("c"), 0); // Exactly 8 bytes total.
    expect(store.get("b", 0)?.value).toBe("b");
    expect(store.get("c", 0)?.value).toBe("c");
    store.set("d", entry("\u{1f600}"), 0); // 1 + 6; evicts b and c.
    expect(store.get("b", 0)).toBeUndefined();
    expect(store.get("c", 0)).toBeUndefined();
    expect(store.get("d", 0)?.value).toBe("\u{1f600}");
    store.set("long-key", entry("x"), 0);
    expect(store.get("long-key", 0)).toBeUndefined();
  });

  test("oversized or nonserializable replacement removes the old entry", () => {
    const { store } = fixture({ maxEntries: 2, maxBytes: 10 });
    for (const value of ["1234567890", undefined, 1n]) {
      store.set("a", entry("old"), 0);
      store.set("a", entry(value), 0);
      expect(store.get("a", 0)).toBeUndefined();
    }
    store.set("b", entry("ok"), 0);
    expect(store.get("b", 0)?.value).toBe("ok");
  });

  test("zero limits do not retain entries", () => {
    for (const limits of [{ maxEntries: 0, maxBytes: 100 }, { maxEntries: 10, maxBytes: 0 }]) {
      const { store } = fixture(limits);
      store.set("a", entry("old"), 0);
      expect(store.get("a", 0)).toBeUndefined();
    }
  });

  test("reopening enforces smaller count and byte bounds", () => {
    for (const limits of [{ maxEntries: 1, maxBytes: 100 }, { maxEntries: 10, maxBytes: 4 }]) {
      const { store, options } = fixture();
      store.set("a", entry("a"), 0);
      store.set("b", entry("b"), 0);
      store.close();
      const reopened = new SnapshotPersistence({ ...options, ...limits });
      stores.push(reopened);
      expect(reopened.get("a", 0)).toBeUndefined();
      expect(reopened.get("b", 0)?.value).toBe("b");
    }
  });

  test("hard expiry deletes rows and cannot be extended by reads or cooldown", () => {
    const { store, options } = fixture();
    store.set("a", entry("old"), 0);
    store.deferRefresh("a", 2000, 9000);
    expect(store.get("a", 1999)?.value).toBe("old");
    expect(store.get("a", 2000)).toBeUndefined();
    const db = new Database(options.path);
    try { expect(db.query("SELECT COUNT(*) AS count FROM snapshots_v1").get()).toEqual({ count: 0 }); }
    finally { db.close(); }
  });

  test("expired rows are pruned before evicting live entries", () => {
    const { store } = fixture();
    store.set("a", entry("live", 4000), 0);
    store.set("b", entry("expired"), 0);
    store.set("c", entry("new", 4000), 2000);
    expect(store.get("a", 2000)?.value).toBe("live");
    expect(store.get("b", 2000)).toBeUndefined();
    expect(store.get("c", 2000)?.value).toBe("new");
  });

  test("malformed JSON and invalid timestamp data are misses, not a disabled store", () => {
    const { store, options } = fixture();
    store.set("a", entry("old"), 0);
    store.set("b", entry("old"), 0);
    const db = new Database(options.path);
    try {
      db.query("UPDATE snapshots_v1 SET payload = ? WHERE key = ?").run("{broken", "a");
      db.query("UPDATE snapshots_v1 SET freshUntil = ? WHERE key = ?").run(3000, "b");
    } finally { db.close(); }
    expect(store.get("a", 0)).toBeUndefined();
    expect(store.get("b", 0)).toBeUndefined();
    store.set("c", entry("ok"), 0);
    expect(store.get("c", 0)?.value).toBe("ok");
  });

  test("corrupt files and database write failures are best effort", () => {
    const corrupt = fixture();
    writeFileSync(corrupt.options.path, "not a sqlite database");
    expect(corrupt.store.get("a", 0)).toBeUndefined();
    expect(() => corrupt.store.set("a", entry("fresh"), 0)).not.toThrow();

    const broken = fixture();
    broken.store.set("a", entry("old"), 0);
    const db = new Database(broken.options.path);
    try { db.exec("DROP TABLE snapshots_v1"); } finally { db.close(); }
    expect(() => broken.store.set("b", entry("fresh"), 0)).not.toThrow();
    expect(broken.store.get("a", 0)).toBeUndefined();
    expect(() => broken.store.deferRefresh("a", 2000, 1500)).not.toThrow();
  });
});
