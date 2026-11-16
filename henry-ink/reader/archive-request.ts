import type { ArchiveResponse } from '@/api/archive/routes';

function waitForRetry(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export function retryDelay(value: string | null, now = Date.now()): number | null {
  if (!value) return 5000;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  if (!Number.isFinite(delay)) return 5000;
  // Do not retry earlier than a long server cooldown; leave it to the user.
  return delay > 15000 ? null : Math.max(1000, delay);
}

/** The site's own address cannot serve this read (closed, broken, or busy): the API should be asked instead. */
export class NotAnArchive extends Error {
  constructor() { super('The article could not be loaded. Try again or open the source.'); }
}

export async function requestArchive(url: string, signal: AbortSignal, onRetry: () => void, dependencies: {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  wait: (milliseconds: number, signal: AbortSignal) => Promise<void>;
} = {
  fetch: (url, init) => fetch(url, init),
  wait: waitForRetry,
}, busy: 'wait' | 'ask-elsewhere' = 'wait'): Promise<ArchiveResponse> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    const response = await dependencies.fetch(url, { signal });
    signal.throwIfAborted();
    if (response.ok) {
      if ((response.headers.get('Content-Type') || '').includes('json')) return response.json() as Promise<ArchiveResponse>;
      await response.body?.cancel();
      throw new NotAnArchive();
    }
    // Cloudflare's own error pages are HTML; the article service always answers in JSON.
    if (response.status >= 500 && !(response.headers.get('Content-Type') || '').includes('json')) {
      await response.body?.cancel();
      throw new NotAnArchive();
    }
    await response.body?.cancel();
    if (response.status === 429) {
      if (busy === 'ask-elsewhere') throw new NotAnArchive();
      const delay = retryDelay(response.headers.get('Retry-After'));
      if (attempt < 2 && delay !== null) {
        onRetry();
        await dependencies.wait(delay, signal);
        continue;
      }
      throw new Error('The article service is busy. Try again shortly.');
    }
    throw new Error(`The article could not be loaded (${response.status}). Try again or open the source.`);
  }
}

/**
 * Kept pages come from the site's own address (`front`). If that stops
 * answering as the article service (its daily allowance ran out, or it
 * crashed), reading must not stop with it: ask the API directly.
 *
 * The same goes for "busy". The API sees every first-time capture made
 * through `front` as coming from one address, so one heavy reader can spend
 * that shared budget. Asked directly, the API gives each reader their own.
 * The reader therefore never waits on `front`: only the API's own "busy" is
 * waited for and, if it persists, shown.
 */
export function requestKeptArchive(front: string, api: string, url: string, signal: AbortSignal, onRetry: () => void,
  dependencies?: Parameters<typeof requestArchive>[3]): Promise<ArchiveResponse> {
  const path = `/api/archive?${new URLSearchParams({ url })}`;
  if (front === api) return requestArchive(api + path, signal, onRetry, dependencies);
  return requestArchive(front + path, signal, onRetry, dependencies, 'ask-elsewhere').catch(error => {
    if (!(error instanceof NotAnArchive)) throw error;
    return requestArchive(api + path, signal, onRetry, dependencies);
  });
}
