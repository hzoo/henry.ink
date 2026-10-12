import { expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import type { AnnotationView } from '@/src/lib/annotations/margin';

test('reuses the article index and invalidates it for source, visibility, viewport, and root changes', async () => {
  const dom = new JSDOM('<!doctype html><body><article><p>Original passage</p></article><div id="mount"></div></body>', { url: 'https://henry.ink/' });
  dom.window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof dom.window.matchMedia;
  const prior = { window: globalThis.window, document: globalThis.document, AbortController: globalThis.AbortController, Event: globalThis.Event };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, AbortController: dom.window.AbortController, Event: dom.window.Event });
  const { h, render, options } = await import('preact');
  options.requestAnimationFrame = callback => { setTimeout(callback, 0); };
  const { InlineNotes } = await import('@/henry-ink/reader/InlineNotes');
  const { readerNotes, matchedNotes } = await import('@/henry-ink/reader/notes');
  const { extractedQuotes, quotesUrl, showReaderAnchor } = await import('@/src/lib/highlights/signals');
  const doc = dom.window.document;
  const root = doc.querySelector('article') as HTMLElement;
  const mount = doc.querySelector('#mount') as HTMLElement;
  const url = 'https://example.com/article';
  const originalWalker = doc.createTreeWalker.bind(doc);
  let walks = 0;
  doc.createTreeWalker = ((...args: Parameters<Document['createTreeWalker']>) => {
    walks++;
    return originalWalker(...args);
  }) as Document['createTreeWalker'];
  const quote = (exact: string) => ({
    id: exact, quote: exact, postUri: 'at://did:plc:test/app.bsky.feed.post/1',
    postData: { author: { displayName: 'Reader', handle: 'reader.test' }, record: { text: 'A note' } },
    ranges: [],
  });
  const flush = () => new Promise(resolve => setTimeout(resolve, 10));
  try {
    readerNotes.value = { status: 'idle', url };
    quotesUrl.value = url;
    extractedQuotes.value = [quote('Original passage')] as typeof extractedQuotes.value;
    render(h(InlineNotes, { root, url }), mount);
    await flush();
    expect(walks).toBe(1);
    expect(matchedNotes.value.has('Original passage')).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(walks).toBe(1);
    expect(root.querySelectorAll('aside')).toHaveLength(1);

    extractedQuotes.value = [quote('Original passage')] as typeof extractedQuotes.value;
    await flush();
    expect(walks).toBe(1);
    expect(root.querySelectorAll('aside')).toHaveLength(1);

    root.querySelector('p')!.textContent = 'Changed passage';
    extractedQuotes.value = [quote('Changed passage')] as typeof extractedQuotes.value;
    await flush();
    expect(walks).toBe(2);
    expect(matchedNotes.value.has('Changed passage')).toBe(true);

    root.querySelector('p')!.setAttribute('hidden', '');
    await flush();
    expect(walks).toBe(3);
    expect(matchedNotes.value.size).toBe(0);

    root.querySelector('p')!.removeAttribute('hidden');
    await flush();
    expect(walks).toBe(4);
    expect(matchedNotes.value.has('Changed passage')).toBe(true);

    dom.window.dispatchEvent(new dom.window.Event('resize'));
    await new Promise(resolve => setTimeout(resolve, 130));
    expect(walks).toBe(5);

    const other = doc.createElement('article');
    other.innerHTML = '<p>Other passage</p>';
    doc.body.appendChild(other);
    extractedQuotes.value = [quote('Other passage')] as typeof extractedQuotes.value;
    await flush();
    expect(matchedNotes.value.size).toBe(0);
    render(h(InlineNotes, { root: other, url }), mount);
    await flush();
    expect(walks).toBe(6);
    expect(matchedNotes.value.has('Other passage')).toBe(true);
    root.querySelector('p')!.textContent = 'Old root changed again';
    await flush();
    expect(walks).toBe(6);
    expect(matchedNotes.value.has('Other passage')).toBe(true);

    render(null, mount);
    other.querySelector('p')!.textContent = 'Unmounted root changed';
    await flush();
    expect(walks).toBe(6);
    expect(other.querySelectorAll('aside')).toHaveLength(0);
    expect(matchedNotes.value.size).toBe(0);

    const note: AnnotationView = {
      uri: 'at://did:plc:test/at.margin.highlight/1', collection: 'at.margin.highlight',
      via: 'margin', motivation: 'highlighting', author: { did: 'did:plc:test', handle: 'reader.test' },
      target: `${url}/`, createdAt: '2026-07-25T00:00:00Z', labels: [],
      anchor: { kind: 'quote', exact: 'Unmounted root changed' },
    };
    extractedQuotes.value = [];
    readerNotes.value = { status: 'ready', url, items: [note], skipped: 0 };
    render(h(InlineNotes, { root: other, url }), mount);
    await flush();
    expect(matchedNotes.value.size).toBe(0);
    const beforeUnmount = walks;
    dom.window.dispatchEvent(new dom.window.Event('resize'));
    render(null, mount);
    await new Promise(resolve => setTimeout(resolve, 130));
    expect(walks).toBe(beforeUnmount);
    render(h(InlineNotes, { root: other, url, resolvedUrl: `${url}/` }), mount);
    await flush();
    const host = matchedNotes.value.get(note.uri)!;
    expect(host.previousElementSibling?.textContent).toBe('Unmounted root changed');
    let scrolled = false;
    host.scrollIntoView = () => { scrolled = true; };
    expect(showReaderAnchor(note.uri)).toBe(true);
    expect(scrolled).toBe(true);
    expect(host.shadowRoot?.querySelector('details')).toBeNull();
    expect(host.shadowRoot?.querySelector('p')).toBeNull();
    expect(host.shadowRoot?.querySelector('.author')?.textContent).toBe('reader.test');
    expect(host.shadowRoot?.querySelector('time')?.dateTime).toBe(note.createdAt);
    expect(host.shadowRoot?.querySelector('a svg')).not.toBeNull();
    expect(host.shadowRoot?.querySelector('a')?.getAttribute('aria-label')).toContain('Open Margin record');
    readerNotes.value = { status: 'ready', url, items: [{ ...note, body: { kind: 'text', text: 'A real comment', format: 'text/plain' } }], skipped: 0 };
    await flush();
    const commentHost = matchedNotes.value.get(note.uri)!;
    commentHost.scrollIntoView = () => {};
    expect(showReaderAnchor(note.uri)).toBe(true);
    expect(commentHost.shadowRoot?.querySelector('details')?.open).toBe(true);
    expect(commentHost.shadowRoot?.querySelector('p')?.textContent).toBe('A real comment');
    const beforeResize = walks;
    for (let event = 0; event < 5; event++) {
      dom.window.dispatchEvent(new dom.window.Event('resize'));
      await flush();
    }
    expect(walks).toBe(beforeResize);
    await new Promise(resolve => setTimeout(resolve, 130));
    expect(walks).toBe(beforeResize + 1);
    expect(matchedNotes.value.get(note.uri)?.shadowRoot?.querySelector('details')?.open).toBe(true);
    render(h(InlineNotes, { root: other, url }), mount);
    await flush();
    expect(matchedNotes.value.size).toBe(0);
  } finally {
    render(null, mount);
    readerNotes.value = { status: 'idle', url: '' };
    extractedQuotes.value = [];
    quotesUrl.value = '';
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});
