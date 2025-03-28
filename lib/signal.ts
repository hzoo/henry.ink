import type { Signal } from "@preact/signals-react";
import { effect, signal } from "@preact/signals-react";

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
   * @param storage - An object implementing the Storage interface for persisting the signal.
   * @returns A signal with a persisted value that updates storage on changes.
   */
  export const persistSignal = <T>(
    key: string,
    initialValue: T,
    storage: Storage
  ): Signal<T> => {
    const persistedValue = storage.getItem(STORAGE_PREFIX + key);
  
    const data = persistedValue
      ? signal(JSON.parse(persistedValue) as T)
      : signal(initialValue);
  
    effect(() => {
      storage.setItem(STORAGE_PREFIX + key, JSON.stringify(data.value));
    });
  
    return data;
  };

  /**
 * Persists a signal in `localStorage`.
 *
 * @param key The key to use when storing and retrieving the value.
 * @param initialValue The initial value of the signal if no persisted value is found.
 * @returns A new signal with the persisted value.
 */
export const signalL = <T>(key: string, initialValue: T): Signal<T> =>
    persistSignal(key, initialValue, window.localStorage);
  