import { expect, mock, spyOn, test } from 'bun:test';
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
  const readable = await import('@/henry-ink/reader/readable');
  const sanitize = spyOn(readable, 'sanitizeReadableHtml');
  const { contentStateSignal, contentModeSignal } = await import('@/henry-ink/signals');
  const { currentUrl } = await import('@/src/lib/messaging');
  const { MarkdownSite } = await import('@/henry-ink/components/MarkdownSite');
  const mount = dom.window.document.querySelector('#mount') as HTMLElement;
  const url = 'https://example.com/article';
  const settle = () => new Promise(resolve => setTimeout(resolve, 10));
  try {
    currentUrl.value = url;
    contentModeSignal.value = 'md';
    const first = '<p style="color:red" class="fixed"><strong>First passage</strong></p><script>evil()</script><link rel="stylesheet" href="https://evil.test/style.css">';
    contentStateSignal.value = { type: 'success', url, mode: 'md', content: 'Plaintext for Arena, not rendering', html: first };
    render(h(MarkdownSite, {}), mount);
    await settle();
    expect(sanitize).toHaveBeenCalledTimes(1);
    expect(mount.querySelector('#output')?.textContent?.trim()).toBe('First passage');
    expect(mount.querySelector('#output')?.innerHTML).toBe('<p><strong>First passage</strong></p>');
    contentStateSignal.value = { type: 'success', url, mode: 'md', content: 'Changed plaintext', html: first };
    await settle();
    expect(sanitize).toHaveBeenCalledTimes(1);
    contentStateSignal.value = { type: 'success', url, mode: 'md', content: 'Second passage', html: '<p>Second <strong>passage</strong></p>' };
    await settle();
    expect(sanitize).toHaveBeenCalledTimes(2);
    expect(mount.querySelector('#output')?.textContent?.trim()).toBe('Second passage');
    contentStateSignal.value = { type: 'success', url, mode: 'archive', content: 'Old mode', html: '<style>body{display:none}</style><p>Old mode</p>' };
    await settle();
    expect(mount.querySelector('#output')).toBeNull();
    contentStateSignal.value = { type: 'success', url: 'https://old.example/', mode: 'md', content: 'Old URL', html: '<p>Old URL</p>' };
    await settle();
    expect(mount.querySelector('#output')).toBeNull();
    expect(sanitize).toHaveBeenCalledTimes(2);
  } finally {
    render(null, mount);
    sanitize.mockRestore();
    mock.restore();
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});
