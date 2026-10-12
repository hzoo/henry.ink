import { expect, test } from 'bun:test';
import { requestArchive, retryDelay } from '@/henry-ink/reader/archive-request';

const busy = () => new Response('private upstream details', { status: 429, headers: { 'Retry-After': '5' } });

test('respects Retry-After then returns the successful archive', async () => {
  let calls = 0;
  let notices = 0;
  const waits: number[] = [];
  const result = await requestArchive('https://api.example.test/archive', new AbortController().signal, () => notices++, {
    fetch: async () => ++calls === 1 ? busy() : Response.json({ html: '<p>Article</p>', textContent: 'Article' }),
    wait: async delay => { waits.push(delay); },
  });
  expect(result.html).toBe('<p>Article</p>');
  expect(calls).toBe(2);
  expect(notices).toBe(1);
  expect(waits).toEqual([5000]);
});

test('stops after two retries and never exposes raw upstream content', async () => {
  let calls = 0;
  await expect(requestArchive('https://api.example.test/archive', new AbortController().signal, () => {}, {
    fetch: async () => { calls++; return busy(); }, wait: async () => {},
  })).rejects.toThrow('The article service is busy. Try again shortly.');
  expect(calls).toBe(3);
});

test('navigation aborts cooldown without another fetch', async () => {
  const controller = new AbortController();
  let calls = 0;
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = Object.assign(async () => { calls++; return busy(); }, { preconnect: nativeFetch.preconnect });
  try {
    const request = requestArchive('https://api.example.test/archive', controller.signal, () => setTimeout(() => controller.abort(), 0));
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toBe(1);
  } finally { globalThis.fetch = nativeFetch; }
});

test('does not retry permanent errors or unusually long cooldowns', async () => {
  for (const response of [new Response('details', { status: 403 }), new Response('', { status: 429, headers: { 'Retry-After': '60' } })]) {
    let waits = 0;
    await expect(requestArchive('https://api.example.test/archive', new AbortController().signal, () => {}, {
      fetch: async () => response, wait: async () => { waits++; },
    })).rejects.toThrow();
    expect(waits).toBe(0);
  }
});

test('parses delay and HTTP-date without retrying before the deadline', () => {
  expect(retryDelay('5')).toBe(5000);
  expect(retryDelay(null)).toBe(5000);
  expect(retryDelay('invalid')).toBe(5000);
  expect(retryDelay('0')).toBe(1000);
  expect(retryDelay('60')).toBeNull();
  expect(retryDelay('Mon, 12 Oct 2026 16:00:05 GMT', Date.parse('2026-10-12T16:00:00Z'))).toBe(5000);
});
