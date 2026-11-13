import { expect, test } from 'bun:test';
import { resolveApiBase } from '@/src/lib/api-config';

test('normalizes API overrides and permits a local API during development', () => {
  expect(resolveApiBase('https://preview.example/', true)).toBe('https://preview.example');
  expect(resolveApiBase('http://localhost:3000/', false)).toBe('http://localhost:3000');
});

test('rejects localhost and HTTP API origins in production', () => {
  for (const url of ['http://api.henry.ink', 'https://localhost:3000', 'https://app.localhost', 'https://127.0.0.1', 'https://[::1]', 'https://0.0.0.0']) {
    expect(() => resolveApiBase(url, true)).toThrow();
  }
});

test('rejects credentials and ambiguous API base URLs', () => {
  for (const url of ['https://user:secret@example.com', 'file:///tmp/api', 'https://api.henry.ink/api', 'https://api.henry.ink/?x=1', 'https://api.henry.ink/#fragment']) {
    expect(() => resolveApiBase(url, false)).toThrow();
  }
});
