import { expect, mock, test } from 'bun:test';
import { JSDOM } from 'jsdom';

test('Arena enhancement updates matches in place and replaces source nodes only when HTML changes', async () => {
  const dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { url: 'https://henry.ink/', pretendToBeVisual: true });
  dom.window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof dom.window.matchMedia;
  const prior = { window: globalThis.window, document: globalThis.document, AbortController: globalThis.AbortController,
    NodeFilter: globalThis.NodeFilter, localStorage: globalThis.localStorage };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, AbortController: dom.window.AbortController,
    NodeFilter: dom.window.NodeFilter, localStorage: dom.window.localStorage });
  let matches = [{ slug: 'systems-thinking', title: 'Systems Thinking', matchedText: 'systems thinking' }];
  const queryExports = { ...await import('@tanstack/react-query') };
  mock.module('@tanstack/react-query', () => ({ ...queryExports, useQuery: () => ({ data: matches }) }));
  const { h, render, createRef, options } = await import('preact');
  const previousAnimationFrame = options.requestAnimationFrame;
  options.requestAnimationFrame = callback => { setTimeout(callback, 0); };
  const { ArenaEnhancedContent } = await import('@/henry-ink/components/ArenaEnhancedContent');
  const ref = createRef<HTMLDivElement>();
  const mount = dom.window.document.querySelector('#mount') as HTMLElement;
  let renders = 0;
  const show = (html: string) => render(h(ArenaEnhancedContent, {
    htmlContent: html, contentRef: ref, mode: ++renders % 2 ? 'md' : 'archive',
  }), mount);
  const flush = () => new Promise(resolve => setTimeout(resolve, 10));
  try {
    show('<p>On systems thinking.</p>');
    await flush();
    const root = ref.current;
    const paragraph = mount.querySelector('p');
    expect(mount.querySelector('.arena-channel-link')?.textContent).toBe('systems thinking');
    expect(paragraph?.textContent).toBe('On systems thinking.');
    show('<p>On systems thinking.</p>');
    await flush();
    expect(ref.current).toBe(root);
    expect(mount.querySelector('p')).toBe(paragraph);
    matches = [{ slug: 'systems-thinking-2', title: 'Systems Thinking Again', matchedText: 'systems thinking' }];
    show('<p>On systems thinking.</p>');
    await flush();
    expect(mount.querySelector('p')).toBe(paragraph);
    expect(mount.querySelector('.arena-channel-link')?.getAttribute('data-channel-slug')).toBe('systems-thinking-2');
    expect(mount.querySelectorAll('.arena-channel-link')).toHaveLength(1);
    expect(paragraph?.textContent).toBe('On systems thinking.');
    show('<p>More systems thinking.</p>');
    await flush();
    const changedParagraph = mount.querySelector('p');
    expect(ref.current).toBe(root);
    expect(changedParagraph).not.toBe(paragraph);
    expect(changedParagraph?.textContent).toBe('More systems thinking.');
    expect(mount.querySelectorAll('.arena-channel-link')).toHaveLength(1);
    matches = [];
    show('<p>More systems thinking.</p>');
    await flush();
    expect(mount.querySelector('p')).toBe(changedParagraph);
    expect(mount.querySelector('.arena-channel-link')).toBeNull();
    expect(changedParagraph?.textContent).toBe('More systems thinking.');
  } finally {
    render(null, mount);
    options.requestAnimationFrame = previousAnimationFrame;
    mock.restore();
    mock.module('@tanstack/react-query', () => queryExports);
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});
