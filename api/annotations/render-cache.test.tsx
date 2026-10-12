import { expect, mock, test } from 'bun:test';
import { JSDOM } from 'jsdom';

test('Arena enhancement reuses unchanged HTML and invalidates for content or matches', async () => {
  const dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { url: 'https://henry.ink/' });
  dom.window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof dom.window.matchMedia;
  const prior = { window: globalThis.window, document: globalThis.document, AbortController: globalThis.AbortController,
    NodeFilter: globalThis.NodeFilter, localStorage: globalThis.localStorage };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, AbortController: dom.window.AbortController,
    NodeFilter: dom.window.NodeFilter, localStorage: dom.window.localStorage });
  let matches = [{ slug: 'systems-thinking', title: 'Systems Thinking', matchedText: 'systems thinking' }];
  mock.module('@tanstack/react-query', () => ({ useQuery: () => ({ data: matches }) }));
  const { h, render, createRef } = await import('preact');
  const { ArenaEnhancedContent } = await import('@/henry-ink/components/ArenaEnhancedContent');
  const ref = createRef<HTMLDivElement>();
  const mount = dom.window.document.querySelector('#mount') as HTMLElement;
  const originalCreate = dom.window.document.createElement.bind(dom.window.document);
  let tempDivs = 0;
  dom.window.document.createElement = ((tag: string, ...args: unknown[]) => {
    if (tag === 'div') tempDivs++;
    return originalCreate(tag, ...args as []);
  }) as Document['createElement'];
  let renders = 0;
  const show = (html: string) => render(h(ArenaEnhancedContent, {
    htmlContent: html, contentRef: ref, mode: ++renders % 2 ? 'md' : 'archive',
  }), mount);
  try {
    show('<p>On systems thinking.</p>');
    const first = tempDivs;
    expect(mount.querySelector('.arena-channel-link')?.textContent).toBe('systems thinking');
    show('<p>On systems thinking.</p>');
    expect(tempDivs).toBe(first);
    show('<p>More systems thinking.</p>');
    expect(tempDivs).toBe(first + 1);
    matches = [{ slug: 'systems-thinking', title: 'Systems Thinking', matchedText: 'systems thinking' }];
    show('<p>More systems thinking.</p>');
    expect(tempDivs).toBe(first + 2);
  } finally {
    render(null, mount);
    mock.restore();
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});
