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

export async function requestArchive(url: string, signal: AbortSignal, onRetry: () => void, dependencies: {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  wait: (milliseconds: number, signal: AbortSignal) => Promise<void>;
} = {
  fetch: (url, init) => fetch(url, init),
  wait: waitForRetry,
}): Promise<ArchiveResponse> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    const response = await dependencies.fetch(url, { signal });
    signal.throwIfAborted();
    if (response.ok) return response.json() as Promise<ArchiveResponse>;
    await response.body?.cancel();
    if (response.status === 429) {
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
