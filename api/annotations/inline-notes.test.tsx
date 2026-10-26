import { expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import type { AnnotationView } from '@/src/lib/annotations/margin';

test('reuses the article index and invalidates it for source, visibility, viewport, and root changes', async () => {
  const dom = new JSDOM('<!doctype html><body><article><p>Original passage</p></article><div id="mount"></div></body>', { url: 'https://henry.ink/', pretendToBeVisual: true });
  dom.window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof dom.window.matchMedia;
  const prior = { window: globalThis.window, document: globalThis.document, AbortController: globalThis.AbortController, Event: globalThis.Event };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, AbortController: dom.window.AbortController, Event: dom.window.Event });
  const { h, render, options } = await import('preact');
  const previousAnimationFrame = options.requestAnimationFrame;
  options.requestAnimationFrame = callback => { setTimeout(callback, 0); };
  const { InlineNotes } = await import('@/henry-ink/reader/InlineNotes');
  const { readerNotes } = await import('@/henry-ink/reader/notes');
  const { extractedQuotes, quotesUrl, readerAnchors, showReaderAnchor } = await import('@/src/lib/highlights/signals');
  const doc = dom.window.document;
  const root = doc.querySelector('article') as HTMLElement;
  const mount = doc.querySelector('#mount') as HTMLElement;
  const url = 'https://example.com/article';
  const article = { type: 'success', url, content: '', mode: 'md' } as const;
  const originalWalker = doc.createTreeWalker.bind(doc);
  let walks = 0;
  doc.createTreeWalker = ((...args: Parameters<Document['createTreeWalker']>) => {
    walks++;
    return originalWalker(...args);
  }) as Document['createTreeWalker'];
  const quote = (exact: string) => ({
    id: exact, quote: exact, postUri: 'at://did:plc:test/app.bsky.feed.post/1',
    postData: { author: { displayName: 'Reader', handle: 'reader.test' }, record: { text: 'A note' } },
  });
  const flush = () => new Promise(resolve => setTimeout(resolve, 10));
  try {
    readerNotes.value = { status: 'idle', url };
    quotesUrl.value = url;
    extractedQuotes.value = [quote('Original passage')] as typeof extractedQuotes.value;
    render(h(InlineNotes, { root, article }), mount);
    await flush();
    expect(walks).toBe(1);
    expect(readerAnchors.value?.anchors.has('Original passage')).toBe(true);
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
    expect(readerAnchors.value?.anchors.has('Changed passage')).toBe(true);

    root.querySelector('p')!.setAttribute('hidden', '');
    await flush();
    expect(walks).toBe(3);
    expect(readerAnchors.value!.anchors.size).toBe(0);

    root.querySelector('p')!.removeAttribute('hidden');
    await flush();
    expect(walks).toBe(4);
    expect(readerAnchors.value?.anchors.has('Changed passage')).toBe(true);

    dom.window.dispatchEvent(new dom.window.Event('resize'));
    await new Promise(resolve => setTimeout(resolve, 130));
    expect(walks).toBe(5);

    const other = doc.createElement('article');
    other.innerHTML = '<p>Other passage</p>';
    doc.body.appendChild(other);
    extractedQuotes.value = [quote('Other passage')] as typeof extractedQuotes.value;
    await flush();
    expect(readerAnchors.value!.anchors.size).toBe(0);
    render(h(InlineNotes, { root: other, article }), mount);
    await flush();
    expect(walks).toBe(6);
    expect(readerAnchors.value?.anchors.has('Other passage')).toBe(true);
    root.querySelector('p')!.textContent = 'Old root changed again';
    await flush();
    expect(walks).toBe(6);
    expect(readerAnchors.value?.anchors.has('Other passage')).toBe(true);

    render(null, mount);
    other.querySelector('p')!.textContent = 'Unmounted root changed';
    await flush();
    expect(walks).toBe(6);
    expect(other.querySelectorAll('aside')).toHaveLength(0);
    expect(readerAnchors.value).toBeNull();

    const note: AnnotationView = {
      uri: 'at://did:plc:test/at.margin.highlight/1', collection: 'at.margin.highlight',
      via: 'margin', motivation: 'highlighting', author: { did: 'did:plc:test', handle: 'reader.test' },
      target: `${url}/`, createdAt: '2026-07-25T00:00:00Z', labels: [],
      anchor: { kind: 'quote', exact: 'Unmounted root changed' },
    };
    extractedQuotes.value = [];
    readerNotes.value = { status: 'ready', url, items: [note], skipped: 0 };
    render(h(InlineNotes, { root: other, article }), mount);
    await flush();
    expect(readerAnchors.value!.anchors.size).toBe(0);
    const beforeUnmount = walks;
    dom.window.dispatchEvent(new dom.window.Event('resize'));
    render(null, mount);
    await new Promise(resolve => setTimeout(resolve, 130));
    expect(walks).toBe(beforeUnmount);
    render(h(InlineNotes, { root: other, article: { ...article, resolvedUrl: `${url}/` } }), mount);
    await flush();
    const host = readerAnchors.value!.anchors.get(note.uri)!;
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
    const commentHost = readerAnchors.value!.anchors.get(note.uri)!;
    expect(commentHost.shadowRoot?.querySelector('details')?.open).toBe(true);
    commentHost.scrollIntoView = () => {};
    expect(showReaderAnchor(note.uri)).toBe(true);
    expect(commentHost.shadowRoot?.querySelector('details')?.open).toBe(true);
    expect(commentHost.shadowRoot?.querySelector('p')?.textContent).toBe('A real comment');
    const beforeInert = walks;
    doc.body.setAttribute('inert', '');
    await flush();
    doc.body.removeAttribute('inert');
    expect(showReaderAnchor(note.uri)).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(walks).toBe(beforeInert);
    expect(readerAnchors.value!.anchors.get(note.uri)).toBe(commentHost);
    expect(commentHost.shadowRoot?.activeElement).toBe(commentHost.shadowRoot?.querySelector('summary'));
    const beforeResize = walks;
    for (let event = 0; event < 5; event++) {
      dom.window.dispatchEvent(new dom.window.Event('resize'));
      await flush();
    }
    expect(walks).toBe(beforeResize);
    await new Promise(resolve => setTimeout(resolve, 130));
    expect(walks).toBe(beforeResize + 1);
    expect(readerAnchors.value!.anchors.get(note.uri)?.shadowRoot?.querySelector('details')?.open).toBe(true);

    const short = readerAnchors.value!.anchors.get(note.uri)!.shadowRoot!.querySelector('details')!;
    short.open = false;
    const longNote: AnnotationView = { ...note, uri: `${note.uri}-long`, author: { did: 'did:plc:other', name: 'Another reader' }, body: { kind: 'text', text: 'A longer comment. '.repeat(40), format: 'text/plain' } };
    const highlight: AnnotationView = { ...note, uri: `${note.uri}-highlight` };
    readerNotes.value = { status: 'ready', url, items: [highlight, longNote, longNote, { ...note, body: { kind: 'text', text: 'A real comment', format: 'text/plain' } }], skipped: 0 };
    await flush();
    expect(other.querySelectorAll('aside')).toHaveLength(1);
    const groupHost = readerAnchors.value!.anchors.get(note.uri)!;
    groupHost.scrollIntoView = () => {};
    expect(readerAnchors.value!.anchors.get(longNote.uri)).toBe(groupHost);
    expect(readerAnchors.value!.anchors.get(highlight.uri)).toBe(groupHost);
    const discussions = [...groupHost.shadowRoot!.querySelectorAll('details')];
    expect(discussions).toHaveLength(2);
    expect(discussions.every(details => !details.open)).toBe(true);
    expect(discussions[0].dataset.noteId).toBe(longNote.uri);
    expect(discussions[0].querySelector('.preview')?.textContent).toBe(longNote.body?.kind === 'text' ? longNote.body.text.trim() : '');
    expect(groupHost.shadowRoot!.querySelector('.highlights [data-note-id]')?.getAttribute('data-note-id')).toBe(highlight.uri);
    expect(showReaderAnchor(longNote.uri)).toBe(true);
    expect(discussions[0].open).toBe(true);
    expect(discussions[1].open).toBe(false);

    readerNotes.value = { status: 'ready', url, items: [], skipped: 0 };
    const beforeEmpty = walks;
    await flush();
    expect(other.querySelectorAll('aside')).toHaveLength(0);
    expect(readerAnchors.value!.anchors.size).toBe(0);
    other.querySelector('p')!.textContent = 'No notes need an index';
    await flush();
    expect(walks).toBe(beforeEmpty);
    render(h(InlineNotes, { root: other, article }), mount);
    await flush();
    expect(readerAnchors.value!.anchors.size).toBe(0);
  } finally {
    render(null, mount);
    options.requestAnimationFrame = previousAnimationFrame;
    readerNotes.value = { status: 'idle', url: '' };
    extractedQuotes.value = [];
    quotesUrl.value = '';
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});
