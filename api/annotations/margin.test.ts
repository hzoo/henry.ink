import { describe, expect, test } from 'bun:test';
import { decodeMarginTargets } from '@/src/lib/annotations/margin';
import { marginAnnotationsRoute } from '@/api/annotations/routes';

const did = 'did:plc:yqzkauibhx455nyffbcs57ty';
const note = {
  id: `at://${did}/at.margin.note/3mxnpqz7dk32a`,
  motivation: 'commenting',
  creator: { did, handle: 'example.com', displayName: 'Example' },
  created: '2026-10-12T04:49:56.177005Z',
  target: {
    source: 'https://example.com/article',
    selector: { type: 'TextQuoteSelector', exact: 'a passage', prefix: 'before ', suffix: ' after' },
  },
  body: { value: '<script>not executable</script>', format: 'text/html' },
};
const payload = (entries: unknown[] = [note]) => ({ annotations: entries, highlights: [], bookmarks: [] });
const request = (query = 'url=https%3A%2F%2Fexample.com%2Farticle') =>
  new Request(`https://api.henry.ink/api/annotations/margin?${query}`, {
    headers: { Origin: 'https://henry.ink', Authorization: 'Bearer never-forward', Cookie: 'private=1' },
  });

describe('Margin read model', () => {
  test('preserves quote context, original identity, body format and moderation labels', () => {
    const { items } = decodeMarginTargets(payload([{
      ...note, labels: [{ val: 'porn', src: did, scope: 'content' }],
    }]));
    expect(items[0]).toMatchObject({
      uri: note.id, via: 'margin', collection: 'at.margin.note',
      anchor: { kind: 'quote', exact: 'a passage', prefix: 'before ', suffix: ' after' },
      labels: [{ value: 'porn', source: did, scope: 'content' }],
    });
  });

  test('keeps HTML as untrusted text rather than producing renderable markup', () => {
    expect(decodeMarginTargets(payload()).items[0].body).toEqual({
      kind: 'text', text: note.body.value, format: 'text/html', uri: undefined,
    });
  });

  test('preserves reference-only bodies and bookmark descriptions without fetching them', () => {
    const { items } = decodeMarginTargets(payload([{
      ...note, body: { uri: 'https://example.com/note', format: 'text/plain' }, description: 'Bookmark context',
    }]));
    expect(items[0].body).toEqual({ kind: 'reference', uri: 'https://example.com/note', format: 'text/plain' });
    expect(items[0].description).toBe('Bookmark context');
    expect(decodeMarginTargets(payload([{ ...note, body: { uri: 'javascript:alert(1)' } }])).items[0].body)
      .toEqual({ kind: 'unsupported' });
  });

  test('reads legacy notes and keeps Semble bookmarks as page-level context', () => {
    const legacy = { ...note, id: note.id.replace('at.margin.note', 'at.margin.annotation') };
    const bookmark = {
      ...note, id: note.id.replace('at.margin.note', 'network.cosmik.card'),
      motivation: 'bookmarking', target: { source: note.target.source },
    };
    const { items } = decodeMarginTargets(payload([legacy, bookmark]));
    expect(items.map(item => item.collection)).toEqual(['at.margin.annotation', 'network.cosmik.card']);
    expect(items[1].anchor).toEqual({ kind: 'page' });
  });

  test('does not silently turn unsupported or refined selectors into page notes', () => {
    for (const selector of [
      { type: 'CssSelector', value: 'p' },
      { ...note.target.selector, refinedBy: { type: 'TextPositionSelector', start: 1, end: 2 } },
      { type: 'TextQuoteSelector', exact: '' },
    ]) {
      expect(decodeMarginTargets(payload([{ ...note, target: { ...note.target, selector } }])).items[0].anchor)
        .toEqual({ kind: 'unsupported' });
    }
  });

  test('deduplicates record URIs across response groups', () => {
    expect(decodeMarginTargets({ ...payload(), highlights: [note] }).items).toHaveLength(1);
  });

  test('rejects malformed identity, unsafe targets and unknown collections', () => {
    const entries = [null, {}, { ...note, creator: { did: 'did:plc:another' } },
      { ...note, id: `${note.id}#/fragment` },
      { ...note, id: note.id.replace('at.margin.note', 'unknown.test.note') },
      { ...note, target: { source: 'javascript:alert(1)' } },
      { ...note, target: { source: 'https://user:password@example.com/' } },
      { ...note, labels: [{ val: 'porn' }] }, { ...note, created: 'not a date' }];
    expect(decodeMarginTargets(payload(entries))).toEqual({ items: [], skipped: entries.length });
  });

  test('fails on a changed response envelope rather than claiming there are no notes', () => {
    expect(() => decodeMarginTargets({ items: [] })).toThrow();
  });
});

describe('Margin read endpoint', () => {
  test('uses only the fixed upstream, does not forward credentials, and does not claim completeness', async () => {
    const response = await marginAnnotationsRoute(request(), async (url, options) => {
      expect(url.origin).toBe('https://margin.at');
      expect(url.pathname).toBe('/api/targets');
      expect(url.searchParams.get('source')).toBe(note.target.source);
      expect(options.redirect).toBe('error');
      expect(options.credentials).toBe('omit');
      expect(options.headers).toEqual({ Accept: 'application/json' });
      return Response.json(payload());
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBe('https://henry.ink');
    expect(await response.json()).toMatchObject({ page: { offset: 0, limit: 50, completeness: 'unknown' } });
  });

  test('validates inputs before fetching', async () => {
    for (const query of ['', 'url=javascript:alert(1)', 'url=https://example.com&offset=-1',
      'url=https://example.com&offset=1.5', 'url=https://example.com&offset=10001']) {
      const response = await marginAnnotationsRoute(request(query), async () => { throw new Error('must not fetch'); });
      expect(response.status).toBe(400);
    }
  });

  test('passes a bounded offset upstream', async () => {
    const response = await marginAnnotationsRoute(request('url=https://example.com&offset=50'), async url => {
      expect(url.searchParams.get('offset')).toBe('50');
      return Response.json(payload([]));
    });
    expect(response.status).toBe(200);
  });

  test('preserves the exact source string for Margin raw-hash lookup', async () => {
    const response = await marginAnnotationsRoute(request('url=https%3A%2F%2Fatproto.com'), async url => {
      expect(url.searchParams.get('source')).toBe('https://atproto.com');
      return Response.json(payload([]));
    });
    expect((await response.json()).target).toBe('https://atproto.com');
  });

  test('rejects upstream failures, wrong MIME and schema drift', async () => {
    for (const upstream of [new Response('down', { status: 503 }), new Response('<html>'), Response.json({}),
      new Response(JSON.stringify(payload()), { headers: { 'Content-Type': 'application/json-invalid' } })]) {
      expect((await marginAnnotationsRoute(request(), async () => upstream)).status).toBe(502);
    }
  });

  test('rejects writes and does not allow an unrecognized browser origin', async () => {
    const write = new Request(request(), { method: 'POST' });
    expect((await marginAnnotationsRoute(write)).status).toBe(405);
    const req = new Request(request(), { headers: { Origin: 'https://untrusted.example' } });
    const response = await marginAnnotationsRoute(req, async () => Response.json(payload()));
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
    expect(response.headers.get('vary')).toBe('Origin');
  });

  test('cancels an oversized declared body without reading it', async () => {
    let cancelled = false;
    const response = await marginAnnotationsRoute(request(), async () => new Response(
      new ReadableStream({ cancel() { cancelled = true; } }), {
        headers: { 'Content-Type': 'application/json', 'Content-Length': String(2 * 1024 * 1024 + 1) },
      },
    ));
    expect(response.status).toBe(502);
    expect(cancelled).toBe(true);
  });

  test('enforces the byte budget without relying on Content-Length', async () => {
    const upstream = new Response('x'.repeat(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } });
    expect((await marginAnnotationsRoute(request(), async () => upstream)).status).toBe(502);
  });

  test('cancels a stalled response body when the caller aborts', async () => {
    const controller = new AbortController();
    let cancelled = false;
    const req = new Request(request(), { signal: controller.signal });
    const result = marginAnnotationsRoute(req, async () => {
      setTimeout(() => controller.abort(), 10);
      return new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
        headers: { 'Content-Type': 'application/json' },
      });
    });
    expect((await result).status).toBe(504);
    expect(cancelled).toBe(true);
  });
});
