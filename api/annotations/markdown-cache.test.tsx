import { expect, mock, test } from 'bun:test';
import { JSDOM } from 'jsdom';

test('MarkdownSite sanitizes once for unchanged content and invalidates for new content', async () => {
  const dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { url: 'https://henry.ink/' });
  dom.window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof dom.window.matchMedia;
  const prior = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage,
    AbortController: globalThis.AbortController };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
    AbortController: dom.window.AbortController });
  const { h, render, options } = await import('preact');
  options.requestAnimationFrame = callback => { setTimeout(callback, 0); };
  mock.module('preact-iso', () => ({ useLocation: () => ({ path: '/article' }) }));
  mock.module('@/henry-ink/services', () => ({ useUrlPathSyncer() {}, useContentFetcher() {} }));
  mock.module('@/henry-ink/reader/notes', () => ({ useReaderNotes() {} }));
  mock.module('@/henry-ink/components/ArenaEnhancedContent', () => ({ ArenaEnhancedContent: ({ htmlContent }: { htmlContent: string }) => h('div', { id: 'output', innerHTML: htmlContent }) }));
  for (const [path, name] of [
    ['@/src/components/highlights/HighlightController', 'HighlightController'],
    ['@/src/components/highlights/QuotePositionDots', 'QuotePositionDots'],
    ['@/src/components/highlights/ArenaNavigationController', 'ArenaNavigationController'],
    ['@/henry-ink/components/ArchiveDocument', 'ArchiveDocument'],
    ['@/henry-ink/components/YouTubePlayer', 'YouTubePlayer'],
  ]) mock.module(path, () => ({ [name]: () => null }));
  const DOMPurify = (await import('dompurify')).default;
  const originalSanitize = DOMPurify.sanitize;
  const boundSanitize = originalSanitize ?? DOMPurify(dom.window).sanitize;
  let sanitizations = 0;
  DOMPurify.sanitize = ((...args: Parameters<typeof boundSanitize>) => {
    sanitizations++;
    return boundSanitize(...args);
  }) as typeof DOMPurify.sanitize;
  const { contentStateSignal, contentModeSignal } = await import('@/henry-ink/signals');
  const { currentUrl } = await import('@/src/lib/messaging');
  const { MarkdownSite } = await import('@/henry-ink/components/MarkdownSite');
  const mount = dom.window.document.querySelector('#mount') as HTMLElement;
  const url = 'https://example.com/article';
  const settle = () => new Promise(resolve => setTimeout(resolve, 10));
  try {
    currentUrl.value = url;
    contentModeSignal.value = 'md';
    contentStateSignal.value = { type: 'success', url, mode: 'md', content: 'First **passage**' };
    render(h(MarkdownSite, {}), mount);
    await settle();
    expect(sanitizations).toBe(1);
    expect(mount.querySelector('#output')?.textContent?.trim()).toBe('First passage');
    contentStateSignal.value = { type: 'success', url, mode: 'md', content: 'First **passage**' };
    await settle();
    expect(sanitizations).toBe(1);
    contentStateSignal.value = { type: 'success', url, mode: 'md', content: 'Second **passage**' };
    await settle();
    expect(sanitizations).toBe(2);
    expect(mount.querySelector('#output')?.textContent?.trim()).toBe('Second passage');
  } finally {
    render(null, mount);
    if (originalSanitize) DOMPurify.sanitize = originalSanitize;
    else delete (DOMPurify as { sanitize?: typeof boundSanitize }).sanitize;
    mock.restore();
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});
