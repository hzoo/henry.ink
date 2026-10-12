import { expect, test } from 'bun:test';
import { createArchiveHandler, createAssetProxyHandler } from '@/api/archive/routes';
import { createArchiveService } from '@/api/archive/processor';

function request(ip: string, url?: string) {
  return new Request(`http://localhost:3000/api/archive${url ? `?${new URLSearchParams({ url })}` : ''}`, {
    headers: { Origin: 'http://127.0.0.1:3003', 'X-Forwarded-For': ip },
  });
}

test('already-cancelled readers do not start or queue a capture', async () => {
  let calls = 0;
  const route = createArchiveHandler(async () => { calls++; throw new Error('Must not run'); });
  const controller = new AbortController();
  controller.abort();
  const req = new Request('http://localhost:3000/api/archive?url=https://example.com', { signal: controller.signal });
  expect((await route(req)).status).toBe(499);
  expect(calls).toBe(0);
});

test('strict capture budget does not throttle cached archive reads', async () => {
  let captures = 0;
  const service = createArchiveService(async url => {
    captures++;
    return {
      fullHTMLContent: '<!doctype html><p>Article</p><img src="/limit-asset.png">',
      cssSources: [],
      pageData: { baseUrl: url, cssSources: [], htmlAttrs: { class: '', style: '', lang: 'en' }, bodyAttrs: { class: '', style: '' },
        metadata: { title: 'Article', author: '', publishedTime: '', domain: 'example.com', url } },
    };
  });
  const route = createArchiveHandler(service);
  for (let i = 0; i < 3; i++) expect((await route(request('capture-budget', `https://example.com/${i}`))).status).toBe(200);
  const limited = await route(request('capture-budget', 'https://example.com/new'));
  expect(limited.status).toBe(429);
  expect(limited.headers.get('Retry-After')).toBe('5');
  expect(limited.headers.get('Access-Control-Expose-Headers')).toContain('Retry-After');
  expect(captures).toBe(3);
  for (let i = 0; i < 5; i++) {
    const cached = await route(request('capture-budget', 'https://example.com/0'));
    expect(cached.status).toBe(200);
    expect(cached.headers.get('Cache-Control')).toBe('no-store');
  }
  expect(captures).toBe(3);
});

test('general read budget still bounds invalid and cheap requests', async () => {
  const route = createArchiveHandler();
  for (let i = 0; i < 30; i++) expect((await route(request('read-budget'))).status).toBe(400);
  const limited = await route(request('read-budget'));
  expect(limited.status).toBe(429);
  expect(limited.headers.get('Retry-After')).toBe('1');
});

test('cached responses re-register exact assets without fetching the source', async () => {
  let admitted = false;
  const url = 'https://assets.example/from-persisted-cache.png';
  const route = createArchiveHandler(async (_url, _assets, _links, _admit) => ({
    html: `<img src="http://localhost:3000/api/asset-proxy?url=${encodeURIComponent(url)}">`,
    css: '', textContent: 'Cached article', title: '', author: '', publishedTime: '', domain: 'example.com',
    url: _url, resolvedUrl: _url, extractionTime: 0, contentSize: 0, htmlAttrs: {}, bodyAttrs: {},
  }));
  expect((await route(request('cached-assets', 'https://example.com/cached'))).status).toBe(200);
  const proxy = createAssetProxyHandler(async input => {
    admitted = input === url;
    return { url: input, status: 200, headers: new Headers({ 'content-type': 'image/png' }), body: Buffer.from('89504e470d0a1a0a', 'hex') };
  });
  await proxy(new Request(`http://localhost:3000/api/asset-proxy?url=${encodeURIComponent(url)}`));
  expect(admitted).toBe(true);
});
