import type { Signal } from "@preact/signals";
import { batch, effect, signal } from "@preact/signals";

export const STORAGE_PREFIX = "site-annotations-";

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Creates a signal that is persisted in the given storage.
 *
 * @template T - The type of the signal value.
 * @param key - The key used to store and retrieve the persisted value.
 * @param initialValue - The initial value of the signal if no persisted value is found.
 * @param storage - Storage to use; defaults to localStorage when available.
 * @returns A signal with a persisted value that updates storage on changes.
 */
export const persistSignal = <T>(
  key: string,
  initialValue: T,
  storage?: Storage
): Signal<T> => {
  const data = signal(initialValue);
  try {
    storage ??= window.localStorage;
    const persistedValue = storage.getItem(STORAGE_PREFIX + key);
    if (persistedValue) data.value = JSON.parse(persistedValue) as T;
  } catch { /* Preferences still work in memory when storage is unavailable. */ }

  effect(() => {
    const value = data.value;
    try {
      storage?.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch { /* Storage limits must not prevent reading or changing preferences. */ }
  });

  return data;
};

interface AsyncStorage<T> {
  get(key: string): Promise<{ [key: string]: T }>;
  set(items: { [key: string]: T }): Promise<void>;
  onChanged: {
    addListener(listener: (changes: Record<string, { newValue?: T }>) => void): void;
  };
}

type BrowserSignal<T> = Signal<T> & { ready: Readonly<Signal<boolean>> };

export const persistBrowserSignal = <T>(
  key: string,
  initialValue: T,
  storage: AsyncStorage<T>,
): BrowserSignal<T> => {
  const ready = signal(false);
  const data = Object.assign(signal(initialValue), { ready });
  let observed = initialValue;
  let changed = false;

  const applyStored = (value: T) => {
    observed = value;
    batch(() => {
      data.value = value;
      ready.value = true;
    });
  };

  storage.onChanged.addListener(changes => {
    if (!Object.hasOwn(changes, key)) return;
    changed = true;
    applyStored(changes[key].newValue ?? initialValue);
  });

  effect(() => {
    const value = data.value;
    if (Object.is(value, observed)) return;
    observed = value;
    changed = true;
    void storage.set({ [key]: value }).catch(error => {
      console.error("Error persisting browser signal:", error);
    });
  });

  void storage.get(key).then(result => {
    if (!changed) applyStored(result[key] ?? initialValue);
    else ready.value = true;
  }).catch(error => {
    console.error("Error loading browser signal:", error);
  });

  return data;
};

function browserSignal<T>(area: 'local' | 'sync', key: string, initialValue: T): BrowserSignal<T> {
  if (typeof browser === 'undefined') {
    return Object.assign(persistSignal(key, initialValue), { ready: signal(true) });
  }
  const storage = browser.storage?.[area];
  return storage
    ? persistBrowserSignal(key, initialValue, storage)
    : Object.assign(signal(initialValue), { ready: signal(false) });
}

export const signalBrowserLocal = <T>(key: string, initialValue: T): BrowserSignal<T> =>
  browserSignal('local', key, initialValue);

export const signalBrowserSync = <T>(key: string, initialValue: T): BrowserSignal<T> =>
  browserSignal('sync', key, initialValue);
