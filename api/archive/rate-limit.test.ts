import { expect, test } from 'bun:test';
import { createArchiveRoute } from '@/api/archive/routes';

test('archive cooldown advertises one token refill and exposes it to the reader', async () => {
  const request = () => new Request('http://localhost:3000/api/archive', {
    headers: { Origin: 'http://127.0.0.1:3003', 'X-Forwarded-For': 'rate-limit-test' },
  });
  for (let i = 0; i < 3; i++) expect((await createArchiveRoute(request())).status).toBe(400);
  const limited = await createArchiveRoute(request());
  expect(limited.status).toBe(429);
  expect(limited.headers.get('Retry-After')).toBe('5');
  expect(limited.headers.get('Access-Control-Expose-Headers')).toContain('Retry-After');
  expect(limited.headers.get('Cache-Control')).toBe('no-store');
});
