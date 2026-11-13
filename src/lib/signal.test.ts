import { expect, test } from "bun:test";
import { computed, effect } from "@preact/signals";
import { persistBrowserSignal } from "./signal";

function deferredStorage<T>() {
  const read = Promise.withResolvers<Record<string, T>>();
  const writes: Record<string, T>[] = [];
  const listeners = new Set<(changes: Record<string, { newValue?: T }>) => void>();
  return {
    read, writes,
    area: {
      get: () => read.promise,
      set: async (values: Record<string, T>) => { writes.push(values); },
      onChanged: { addListener: (listener: (changes: Record<string, { newValue?: T }>) => void) => {
        listeners.add(listener);
      } },
    },
    change: (key: string, value: T) => {
      for (const listener of listeners) listener({ [key]: { newValue: value } });
    },
  };
}

test("hydrating an allowlist first cannot open automatic lookup before the saved opt-out", async () => {
  const sync = deferredStorage<boolean>();
  const local = deferredStorage<Record<string, string>>();
  const autoFetch = persistBrowserSignal("autoFetchEnabled", true, sync.area);
  const domains = persistBrowserSignal("domainSettings", {}, local.area);
  expect([...sync.writes, ...local.writes]).toEqual([]);
  const canSearch = computed(() =>
    autoFetch.ready.value && domains.ready.value && autoFetch.value && domains.value["example.test"] === "a",
  );
  const eligible: boolean[] = [];
  const stop = effect(() => { eligible.push(canSearch.value); });
  try {
    local.read.resolve({ domainSettings: { "example.test": "a" } });
    await local.read.promise;
    expect(domains.value).toEqual({ "example.test": "a" });
    expect(eligible).toEqual([false]);

    sync.read.resolve({ autoFetchEnabled: false });
    await sync.read.promise;
    expect(autoFetch.value).toBe(false);
    expect(eligible).toEqual([false]);
    expect([...sync.writes, ...local.writes]).toEqual([]);
  } finally {
    stop();
  }
});

test("a failed read keeps automatic lookup disabled until storage provides the preference", async () => {
  const storage = deferredStorage<boolean>();
  const autoFetch = persistBrowserSignal("autoFetchEnabled", true, storage.area);
  storage.read.reject(new Error("Storage unavailable"));
  await storage.read.promise.catch(() => {});
  expect(autoFetch.ready.value).toBe(false);
  expect(storage.writes).toEqual([]);

  storage.change("autoFetchEnabled", true);
  expect(autoFetch.ready.value && autoFetch.value).toBe(true);
  storage.change("autoFetchEnabled", false);
  expect(autoFetch.ready.value && autoFetch.value).toBe(false);
  expect(storage.writes).toEqual([]);
});

test("an observed opt-out beats an older hydration result", async () => {
  const storage = deferredStorage<boolean>();
  const autoFetch = persistBrowserSignal("autoFetchEnabled", true, storage.area);
  storage.change("autoFetchEnabled", false);
  storage.read.resolve({ autoFetchEnabled: true });
  await storage.read.promise;
  expect(autoFetch.ready.value && autoFetch.value).toBe(false);
  expect(storage.writes).toEqual([]);

  autoFetch.value = true;
  expect(storage.writes).toEqual([{ autoFetchEnabled: true }]);
});
