export type Fetcher = (url: string, options: RequestInit) => Promise<Response>;

// Limits apply to decoded bytes, not just the server's Content-Length claim.
export const WATCH_MAX_BYTES = 5 * 1024 * 1024;
export const CAPTIONS_MAX_BYTES = 2 * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 15_000;

export async function fetchText(
  url: string,
  options: RequestInit,
  maxBytes: number,
  signal: AbortSignal,
  fetcher: Fetcher,
): Promise<string> {
  signal.throwIfAborted();
  const response = await fetcher(url, {
    ...options, signal, redirect: 'error', credentials: 'omit',
  });
  if (signal.aborted || !response.ok || !response.body ||
      Number(response.headers.get('content-length')) > maxBytes) {
    void response.body?.cancel().catch(() => {});
    signal.throwIfAborted();
    throw new Error('Invalid or oversized YouTube response');
  }

  const reader = response.body.getReader();
  const listeners = new AbortController();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true, signal: listeners.signal });
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('YouTube response too large');
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  } finally {
    listeners.abort();
    cancel();
    reader.releaseLock();
  }
}
