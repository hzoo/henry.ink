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

test('readers on allowed origins receive the same copy; other sites cannot read it', async () => {
  const service = createArchiveService(async url => ({
    fullHTMLContent: '<!doctype html><p>Article</p><a href="next">Next</a><img src="/shared.png">',
    cssSources: [],
    pageData: { baseUrl: url, cssSources: [], htmlAttrs: { class: '', style: '', lang: 'en' }, bodyAttrs: { class: '', style: '' },
      metadata: { title: 'Article', author: '', publishedTime: '', domain: 'example.com', url } },
  }));
  const route = createArchiveHandler(service);
  const bodies: string[] = [];
  const origins = ['https://henry.ink', 'chrome-extension://lbbbgodnfjcndohnhdjkomcckekjpjni', 'http://127.0.0.1:3003', 'https://elsewhere.example', ''];
  for (const [index, origin] of origins.entries()) {
    const response = await route(new Request(`https://${index % 2 ? 'api.henry.ink' : 'localhost:3000'}/api/archive?url=https://example.com/shared`, {
      headers: { ...(origin ? { Origin: origin } : {}), 'X-Forwarded-For': 'shared-copy' },
    }));
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(index < 3 ? origin : null);
    expect(response.headers.get('Vary')).toBe('Origin');
    bodies.push(await response.text());
  }
  expect(new Set(bodies).size).toBe(1);
});

test('general read budget still bounds invalid and cheap requests', async () => {
  const route = createArchiveHandler();
  for (let i = 0; i < 30; i++) expect((await route(request('read-budget'))).status).toBe(400);
  const limited = await route(request('read-budget'));
  expect(limited.status).toBe(429);
  expect(limited.headers.get('Retry-After')).toBe('1');
});

test('every image address in a cleaned page is accepted by the asset proxy as written', async () => {
  const service = createArchiveService(async () => ({
    fullHTMLContent: '<!doctype html><body style="background:url(/paper.png)"><img src="/hero.jpg" srcset="/wide.jpg 900w"><p>Article</p></body>',
    cssSources: [{ content: '@font-face{font-family:Body;src:url(/body.woff2)}', baseUrl: 'https://example.com/site.css', media: '' }],
    pageData: { baseUrl: 'https://example.com/', cssSources: [], htmlAttrs: { class: '', style: '', lang: '' }, bodyAttrs: { class: '', style: '' },
      metadata: { title: '', author: '', publishedTime: '', url: 'https://example.com/', domain: 'example.com' } },
  }));
  const archive = await service('https://example.com/');
  const addresses = [...`${archive.html} ${archive.css} ${archive.bodyAttrs.style}`.replaceAll('&amp;', '&').replaceAll('&quot;', '"')
    .matchAll(/http:\/\/localhost:3000\/api\/asset-proxy\?url=[^"'\s)]+/g)].map(match => match[0]);
  expect(new Set(addresses).size).toBe(4);
  const fetched: string[] = [];
  const proxy = createAssetProxyHandler(async input => {
    fetched.push(input);
    return { url: input, status: 200, headers: new Headers({ 'content-type': 'image/png' }), body: Buffer.from('89504e470d0a1a0a', 'hex') };
  });
  for (const address of new Set(addresses)) {
    const response = await proxy(new Request(address, { headers: { 'X-Forwarded-For': 'signed-page' } }));
    // The font address serves PNG bytes here; reaching validation proves it was admitted.
    expect(response.status).not.toBe(403);
  }
  expect(fetched.sort()).toEqual(['https://example.com/body.woff2', 'https://example.com/hero.jpg', 'https://example.com/paper.png', 'https://example.com/wide.jpg']);
});

test('the API serves a cleaned page inert, unindexed and linked to its original', async () => {
  const route = createArchiveHandler(createArchiveService(async url => ({
    fullHTMLContent: '<!doctype html><p>Article</p>', cssSources: [],
    pageData: { baseUrl: url, cssSources: [], htmlAttrs: { class: '', style: '', lang: 'en' }, bodyAttrs: { class: '', style: '' },
      metadata: { title: 'Article', author: '', publishedTime: '', domain: 'example.com', url } },
  })));
  const response = await route(request('header-reader', 'https://example.com/headers'));
  expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'none'");
  expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
  expect(response.headers.get('Link')).toBe('<https://example.com/headers>; rel="canonical"');
  expect(response.headers.get('Content-Type')).toContain('application/json');
  // henry.ink's function recognises a cleaned page by this opening without parsing it.
  expect(await response.text()).toStartWith('{"html":"');
});
