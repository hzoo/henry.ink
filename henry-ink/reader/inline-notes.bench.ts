import { JSDOM } from 'jsdom';

const paragraphs = Array.from({ length: 600 }, (_, index) => `<p>Paragraph ${index}: ${index % 30 === 0 ? `unique quote ${String(index / 30).padStart(2, '0')} end` : 'ordinary supporting text'}.</p>`).join('');
const dom = new JSDOM(`<body><article>${paragraphs}</article><div id="mount"></div></body>`, { url: 'https://henry.ink/' });
dom.window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof dom.window.matchMedia;
Object.assign(globalThis, { window: dom.window, document: dom.window.document, AbortController: dom.window.AbortController });
const { h, render, options } = await import('preact');
options.requestAnimationFrame = callback => { setTimeout(callback, 0); };
const { InlineNotes } = await import('@/henry-ink/reader/InlineNotes');
const { readerNotes } = await import('@/henry-ink/reader/notes');
const { extractedQuotes, quotesUrl, readerAnchors } = await import('@/src/lib/highlights/signals');
const doc = dom.window.document;
const root = doc.querySelector('article') as HTMLElement;
const mount = doc.querySelector('#mount') as HTMLElement;
const url = 'https://example.com/article';
const article = { type: 'success', url, content: '', mode: 'md' } as const;
const iterations = 30;
const quoteCount = 20;
const quotes = Array.from({ length: quoteCount }, (_, index) => ({
  id: `quote-${index}`, quote: `unique quote ${String(index).padStart(2, '0')} end`,
  postUri: `at://did:plc:test/app.bsky.feed.post/${index}`,
  postData: { author: { displayName: 'Reader', handle: 'reader.test' }, record: { text: `Note ${index}` } },
}));
const originalWalker = doc.createTreeWalker.bind(doc);
let walks = 0;
doc.createTreeWalker = ((...args: Parameters<Document['createTreeWalker']>) => {
  walks++;
  return originalWalker(...args);
}) as Document['createTreeWalker'];

function settled(previous: typeof readerAnchors.value) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { unsubscribe(); reject(new Error('Inline note placement did not settle')); }, 2000);
    const unsubscribe = readerAnchors.subscribe(current => {
      if (!current || current === previous || current.anchors.size !== quoteCount) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve();
    });
  });
}

function snapshot() {
  const hosts = [...root.querySelectorAll('aside')];
  const articleText = root.textContent ?? '';
  const noteText = hosts.map(host => host.shadowRoot?.querySelector('p')?.textContent).join('|');
  const fingerprint = (text: string) => [...text].reduce((hash, char) => Math.imul(hash, 31) + char.charCodeAt(0) | 0, 0);
  return {
    paragraphs: root.querySelectorAll('p').length,
    articleTextLength: articleText.length,
    articleTextHash: fingerprint(articleText),
    hosts: hosts.length,
    noteTextLength: noteText.length,
    noteTextHash: fingerprint(noteText),
    matched: readerAnchors.value!.anchors.size,
    walks,
  };
}

async function measure(mode: 'rebuild' | 'retained') {
  walks = 0;
  const start = performance.now();
  for (let iteration = 0; iteration < iterations; iteration++) {
    const previous = readerAnchors.value;
    const placement = settled(previous);
    extractedQuotes.value = quotes.slice() as unknown as typeof extractedQuotes.value;
    render(h(InlineNotes, { key: mode === 'rebuild' ? iteration : 'retained', root, article }), mount);
    await placement;
  }
  const ms = performance.now() - start;
  const result = { mode, ms: Number(ms.toFixed(1)), ...snapshot() };
  render(null, mount);
  await Promise.resolve();
  return result;
}

readerNotes.value = { status: 'idle', url };
quotesUrl.value = url;
const rebuild = await measure('rebuild');
const retained = await measure('retained');
if (rebuild.paragraphs !== retained.paragraphs || rebuild.articleTextLength !== retained.articleTextLength ||
  rebuild.articleTextHash !== retained.articleTextHash || rebuild.noteTextLength !== retained.noteTextLength ||
  rebuild.noteTextHash !== retained.noteTextHash || rebuild.hosts !== quoteCount || retained.hosts !== quoteCount ||
  rebuild.matched !== quoteCount || retained.matched !== quoteCount || rebuild.walks !== iterations || retained.walks !== 1) {
  throw new Error('Benchmark paths produced different placement output');
}
console.log(JSON.stringify({ rebuild, retained }, null, 2));
dom.window.close();
