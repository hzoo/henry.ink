import { afterEach, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { enhanceArenaLinks } from '@/henry-ink/reader/arena-enhancement';
import type { ArenaMatch } from '@/src/lib/arena-types';

const windows: JSDOM[] = [];
afterEach(() => { for (const dom of windows.splice(0)) dom.window.close(); });

function article(html: string): HTMLElement {
  const dom = new JSDOM('<!doctype html><body></body>');
  windows.push(dom);
  dom.window.document.body.innerHTML = html;
  return dom.window.document.body;
}

function match(matchedText: string, slug = 'example-channel'): ArenaMatch {
  return { matchedText, slug, title: 'Example channel', url: 'https://are.na/channels/' + slug,
    author_name: 'Example', contents_count: 1 };
}

const labels = (root: HTMLElement) => [...root.querySelectorAll('.arena-channel-link')].map(e => e.textContent);

function expectPreserved(root: HTMLElement, html: string) {
  const copy = root.cloneNode(true) as HTMLElement;
  for (const wrapper of copy.querySelectorAll('.arena-channel-link-wrapper')) {
    wrapper.replaceWith(copy.ownerDocument.createTextNode(wrapper.querySelector('button')!.textContent!));
  }
  expect(copy.innerHTML).toBe(html);
}

test('does not split at Amazon and finds the later whole phrase instead', () => {
  const root = article('<p>Work at Amazon, then help at a cost.</p>');
  const before = root.innerHTML;
  enhanceArenaLinks(root, [match('at a')]);
  expect(labels(root)).toEqual(['at a']);
  expect(root.querySelector('p')!.firstChild!.textContent).toBe('Work at Amazon, then help ');
  expectPreserved(root, before);
});

test('rejects partial words on either side, including digits and underscores', () => {
  const root = article('<p>cat a; at Amazon; 2at a; at a2; _at a; at a_cost.</p>');
  const before = root.innerHTML;
  enhanceArenaLinks(root, [match('at a')]);
  expect(labels(root)).toEqual([]);
  expect(root.innerHTML).toBe(before);
});

test('accepts punctuation and true text boundaries while preserving source case', () => {
  const root = article('<p>AT A!</p><p>(Blue sky)</p>');
  const before = root.innerHTML;
  enhanceArenaLinks(root, [match('at a'), match('blue sky', 'sky')]);
  expect(labels(root)).toEqual(['AT A', 'Blue sky']);
  expectPreserved(root, before);
});

test('prefers the longest overlapping phrase and can use a later non-overlapping occurrence', () => {
  const root = article('<p>red blue green; blue green; red blue.</p>');
  const before = root.innerHTML;
  enhanceArenaLinks(root, [
    match('red blue', 'short'), match('blue green', 'other'), match('red blue green', 'long'),
  ]);
  expect(labels(root)).toEqual(['red blue green', 'blue green', 'red blue']);
  expect([...root.querySelectorAll('button')].map(e => e.dataset.channelSlug)).toEqual(['long', 'other', 'short']);
  expect(root.querySelector('.arena-channel-link-wrapper .arena-channel-link-wrapper')).toBeNull();
  expectPreserved(root, before);
});

test('does not annotate the same phrase twice when other replacements split a text node', () => {
  const root = article('<p>blue sky, red moon, blue sky.</p><p>Blue sky again.</p>');
  const before = root.innerHTML;
  enhanceArenaLinks(root, [match('blue sky'), match('red moon'), match('BLUE SKY')]);
  expect(labels(root)).toEqual(['blue sky', 'red moon']);
  expectPreserved(root, before);
});

test('checks word boundaries across inline markup without changing existing elements', () => {
  const root = article('<p><em>at A</em>mazon.</p><p>c<span>at a</span> cost.</p><p><em title="original">at a</em> cost.</p>');
  const before = root.innerHTML;
  const elements = [...root.querySelectorAll('p, em, span')];
  enhanceArenaLinks(root, [match('at a')]);
  expect(labels(root)).toEqual(['at a']);
  expect(root.querySelector('button')!.parentElement!.parentElement === elements[elements.length - 1]).toBe(true);
  for (const element of elements) expect(root.contains(element)).toBe(true);
  expectPreserved(root, before);
});

test('treats paragraphs and line breaks as boundaries, not inline element edges', () => {
  for (const html of ['<p>cat</p><p>at a</p><p>cost</p>', '<p>cat<br>at a<br>cost</p>']) {
    const root = article(html);
    const before = root.innerHTML;
    enhanceArenaLinks(root, [match('at a')]);
    expect(labels(root)).toEqual(['at a']);
    expectPreserved(root, before);
  }
});

test('keeps Unicode letters, combining marks and astral letters inside their words', () => {
  const root = article('<p>\u00e9at a; at a\u754c; at a\u0301; \u{10400}at a; (at a).</p>');
  const before = root.innerHTML;
  enhanceArenaLinks(root, [match('at a')]);
  expect(labels(root)).toEqual(['at a']);
  expect(root.querySelector('button')!.parentElement!.previousSibling!.textContent).toEndWith('; (');
  expectPreserved(root, before);
});

test('preserves offsets after case mappings that change string length', () => {
  const root = article('<p>\u0130 before Blue Sky.</p>');
  const before = root.innerHTML;
  enhanceArenaLinks(root, [match('blue sky')]);
  expect(labels(root)).toEqual(['Blue Sky']);
  expectPreserved(root, before);
});

test('escapes regexp punctuation in literal multi-word matches', () => {
  const root = article('<p>C++ notes; design (notes).</p>');
  const before = root.innerHTML;
  enhanceArenaLinks(root, [match('c++ notes'), match('design (notes)')]);
  expect(labels(root)).toEqual(['C++ notes', 'design (notes)']);
  expectPreserved(root, before);
});

test('leaves links, code, pre, SVG and existing controls unchanged, including descendants', () => {
  const root = article('<a href="/source"><em>blue sky</em></a><code><b>blue sky</b></code><pre><span>blue sky</span></pre><svg><text>blue sky</text></svg><button>blue sky</button><p>blue sky</p>');
  const before = root.innerHTML;
  const excluded = [...root.children].slice(0, -1);
  const originals = excluded.map(e => e.outerHTML);
  enhanceArenaLinks(root, [match('blue sky')]);
  expect(labels(root)).toEqual(['blue sky']);
  expect(excluded.map(e => e.outerHTML)).toEqual(originals);
  expect(root.querySelector('.arena-channel-link')!.closest('p')).not.toBeNull();
  expectPreserved(root, before);
});

test('does not flatten markup to match phrases split across source elements', () => {
  const root = article('<p id="original" style="color: red">blue <em>sky</em> &amp; clouds<!-- keep --></p>');
  const before = root.innerHTML;
  enhanceArenaLinks(root, [match('blue sky')]);
  expect(labels(root)).toEqual([]);
  expect(root.innerHTML).toBe(before);
});

test('ignores empty and single-word matches and keeps channel navigation on valid links', () => {
  const root = article('<p>blue sky</p>');
  const channel = match('blue sky', 'sky');
  enhanceArenaLinks(root, [match(''), match('   '), match('blue'), channel]);
  expect(labels(root)).toEqual(['blue sky']);
  const button = root.querySelector('button')!;
  expect(button.dataset.channelSlug).toBe(channel.slug);
  expect(button.title).toBe('View ' + channel.title + ' in sidebar');
  expect(button.type).toBe('button');
  expect(root.textContent).toBe('blue sky');
  expect(root.querySelector('a')).toBeNull();
});

test('updates and clears context in place without duplicating source text', () => {
  const root = article('<p>blue sky and shared tools</p>');
  const paragraph = root.querySelector('p');
  const before = root.innerHTML;
  enhanceArenaLinks(root, [match('blue sky')]);
  enhanceArenaLinks(root, [match('shared tools')]);
  expect(labels(root)).toEqual(['shared tools']);
  expect(root.textContent).toBe('blue sky and shared tools');
  enhanceArenaLinks(root, []);
  expect(root.innerHTML).toBe(before);
  expect(root.querySelector('p')).toBe(paragraph);
});
