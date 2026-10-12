import type { ArchiveResponse } from '@/api/archive/routes';
import { requestArchive } from '@/henry-ink/reader/archive-request';
import { extractReadableArticle, type ReadableArticle } from '@/henry-ink/reader/readable';

interface Entry {
  archive: ArchiveResponse;
  expiresAt: number;
  readable?: Promise<ReadableArticle>;
}

interface Pending {
  controller: AbortController;
  promise: Promise<Entry>;
  listeners: Map<symbol, () => void>;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export function createArchiveCache({
  limit = 30,
  ttl = 15 * 60 * 1000,
  now = Date.now,
  load = (url: string, signal: AbortSignal, onRetry: () => void) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    return requestArchive(`${apiUrl}/api/archive?${new URLSearchParams({ url })}`, signal, onRetry);
  },
  extract = extractReadableArticle,
} = {}) {
  const entries = new Map<string, Entry>();
  const pending = new Map<string, Pending>();

  async function get(url: string, signal: AbortSignal, onRetry: () => void): Promise<Entry> {
    signal.throwIfAborted();
    const cached = entries.get(url);
    if (cached && cached.expiresAt > now()) {
      entries.delete(url);
      entries.set(url, cached);
      return cached;
    }
    entries.delete(url);
    for (const [key, entry] of entries) if (entry.expiresAt <= now()) entries.delete(key);
    let request = pending.get(url);
    if (!request || request.controller.signal.aborted) {
      const controller = new AbortController();
      const listeners = new Map<symbol, () => void>();
      const promise = load(url, controller.signal, () => {
        for (const notify of listeners.values()) notify();
      }).then(archive => {
        controller.signal.throwIfAborted();
        const entry = { archive, expiresAt: now() + ttl };
        if (limit > 0) {
          entries.set(url, entry);
          while (entries.size > limit) entries.delete(entries.keys().next().value!);
        }
        return entry;
      });
      request = { controller, listeners, promise };
      pending.set(url, request);
      const current = request;
      const remove = () => { if (pending.get(url) === current) pending.delete(url); };
      promise.then(remove, remove);
    }
    const current = request;
    const token = Symbol();
    current.listeners.set(token, () => { if (!signal.aborted) onRetry(); });
    try {
      return await abortable(current.promise, signal);
    } finally {
      current.listeners.delete(token);
      // Mode effects unsubscribe/re-subscribe together. Give the new mode one
      // turn to adopt the request, but cancel abandoned navigation and retries.
      setTimeout(() => {
        if (!current.listeners.size && pending.get(url) === current) {
          pending.delete(url);
          current.controller.abort();
        }
      }, 0);
    }
  }

  return {
    async read(url: string, mode: 'archive' | 'md', signal: AbortSignal, onRetry = () => {}): Promise<ArchiveResponse> {
      const entry = await get(url, signal, onRetry);
      signal.throwIfAborted();
      if (mode === 'archive') return entry.archive;
      if (!entry.readable) {
        entry.readable = extract(entry.archive, url).catch(error => {
          entry.readable = undefined;
          throw error;
        });
      }
      const readable = await abortable(entry.readable, signal);
      signal.throwIfAborted();
      return { ...readable, resolvedUrl: entry.archive.resolvedUrl };
    },
  };
}

export const archiveCache = createArchiveCache();
