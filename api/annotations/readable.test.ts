import { expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { extractReadableArticle, sanitizeReadableHtml } from '@/henry-ink/reader/readable';
import { createArchiveService } from '@/api/archive/processor';

async function extract(html: string, textContent = '', title?: string) {
  const host = new JSDOM('');
  try {
    return await extractReadableArticle({ html, textContent, title, resolvedUrl: 'https://source.test/posts/article' },
      'https://redirect.test/', host.window.document);
  } finally { host.window.close(); }
}

test('short notes retain semantic HTML, headings and links without original styling', async () => {
  const result = await extract('<article class="source"><h1>Note</h1><p style="color:red">First <em>paragraph</em>.</p><h2>More</h2><p><a href="../other">Second</a> paragraph.</p></article>');
  expect(result.html).toContain('<h1>Note</h1>');
  expect(result.html).toContain('<p>First <em>paragraph</em>.</p>');
  expect(result.html).toContain('<h2>More</h2>');
  expect(result.html).toContain('href="https://source.test/other"');
  expect(result.html).not.toMatch(/class=|style=/);
  expect(result.textContent).toBe('Note\nFirst paragraph.\nMore\nSecond paragraph.');
});

test('production reader-wrapped same-page links jump to prefixed footnotes', async () => {
  const url = 'https://source.test/posts/article';
  const service = createArchiveService(async () => ({
    fullHTMLContent: '<!doctype html><h1>Notes</h1><p><a href="article#note">Footnote</a><a href="other#note">Elsewhere</a></p><p id="note">The footnote.</p>',
    cssSources: [],
    pageData: { baseUrl: url, cssSources: [], htmlAttrs: { class: '', style: '', lang: '' }, bodyAttrs: { class: '', style: '' },
      metadata: { title: 'Notes', author: '', publishedTime: '', domain: 'source.test', url } },
  }));
  const archive = await service(url, 'https://api.henry.ink', 'https://henry.ink');
  expect(archive.html).toContain('https://henry.ink/https://source.test/posts/article#note');
  const host = new JSDOM('');
  try {
    const result = await extractReadableArticle(archive, url, host.window.document);
    expect(result.html).toContain('href="#henry-text-note"');
    expect(result.html).toContain('id="henry-text-note"');
    expect(result.html).toContain('href="https://henry.ink/https://source.test/posts/other#note"');
  } finally { host.window.close(); }
});

test('Readability removes surrounding navigation but keeps article paragraphs and ending', async () => {
  const paragraphs = Array.from({ length: 8 }, (_, i) => `<p>Paragraph ${i}. ${'This is a detailed account of a small project, its people, and the things they learned. '.repeat(4)}</p>`).join('');
  const result = await extract(`<nav>Navigation noise</nav><article><h1>Small projects</h1>${paragraphs}<h2>Conclusion</h2><p>Final article paragraph must stay.</p></article><footer>Footer noise</footer>`);
  expect(result.html).not.toContain('Navigation noise');
  expect(result.html).not.toContain('Footer noise');
  expect(result.html).toContain('<h2>Conclusion</h2>');
  expect(result.textContent).toContain('Paragraph 0.');
  expect(result.textContent).toContain('Paragraph 7.');
  expect(result.textContent).toContain('Final article paragraph must stay.');
  expect(result.textContent).not.toContain('<p>');
});

test('legacy table/font pages and extraction-rejected content keep their ending', async () => {
  for (const body of [
    '<table bgcolor="red"><tr><td><font face="Verdana">A brief old page.<br>Ending article sentence.</font></td></tr></table>',
    `<div class="comment sidebar"><p>${'Legacy article prose, not actually a comment. '.repeat(30)}</p><p>Ending article sentence.</p></div>`,
  ]) {
    const result = await extract(body);
    expect(result.textContent).toContain('Ending article sentence.');
    expect(result.html).not.toMatch(/font|bgcolor|class=/);
  }
});

test('empty legacy HTML falls back to escaped captured plaintext, never markdown parsing', async () => {
  const result = await extract('', 'First **literal** paragraph.\n\n<script>not markup</script>', '<img onerror=evil()>');
  expect(result.html).toContain('<p>First **literal** paragraph.</p>');
  expect(result.html).toContain('&lt;script&gt;not markup&lt;/script&gt;');
  expect(result.html).not.toContain('<img');
  expect(result.textContent).toContain('<script>not markup</script>');
});

export const hostileReadableHtml = `<script>window.__sourceExecuted=true</script>
  <style>body{display:none}</style><link rel="stylesheet" href="https://evil.test/style.css">
  <base href="https://evil.test/"><meta http-equiv="refresh" content="0;url=https://evil.test">
  <iframe srcdoc="<script>evil()</script>"></iframe><object data="https://evil.test"></object>
  <p id="location" class="fixed" style="position:fixed" data-channel-slug="spoof" onclick="evil()">Safe paragraph</p>
  <a href="javascript:evil()">Bad URL</a><img src="x" onerror="window.__sourceExecuted=true">
  <svg><a xlink:href="javascript:evil()">SVG</a><foreignObject><script>evil()</script></foreignObject></svg>
  <math><mtext><table><mglyph><style><!--</style><img title="--><img src=1 onerror=evil()>">
  <custom-source onclick="evil()">Passive text</custom-source>`;

test('scripts, CSS, active elements and mXSS stay inert through repeated HTML parsing', async () => {
  const result = await extract(hostileReadableHtml);
  const dom = new JSDOM('');
  try {
    let html = result.html;
    for (let round = 0; round < 3; round++) {
      dom.window.document.body.innerHTML = html;
      expect(dom.window.document.querySelector('script, style, link, base, meta, iframe, object, svg, math, custom-source')).toBeNull();
      for (const element of dom.window.document.querySelectorAll('*')) {
        for (const attr of element.attributes) {
          expect(attr.name).not.toMatch(/^(on|style$|class$|data-)/);
          if (attr.name === 'id' || attr.name === 'name') expect(attr.value).toStartWith('henry-text-');
          expect(attr.value).not.toMatch(/^javascript:/i);
        }
      }
      expect(dom.window.document.body.textContent).toContain('Safe paragraph');
      html = sanitizeReadableHtml(dom.window.document.body.innerHTML, dom.window.document);
    }
  } finally { dom.window.close(); }
});

test('internal footnotes and legacy named anchors stay local, prefixed and idempotent', async () => {
  const result = await extract(`<article><p id="ref">Text<a href="#note%3A1">1</a></p>
    <p id="note:1">Footnote <a href="https://source.test/posts/article#ref">Back</a></p>
    <p><a name="legacy"></a>Legacy target <a href="#legacy">Jump</a></p>
    <p id="location"><a href="#location">Clobber-safe target</a></p>
    <a href="https://other.test/#ref">External</a><a href="#missing">Missing</a></article>`);
  const dom = new JSDOM(result.html);
  try {
    const doc = dom.window.document;
    expect(doc.getElementById('henry-text-note:1')?.textContent).toContain('Footnote');
    expect(doc.querySelector('a[name]')?.getAttribute('name')).toBe('henry-text-legacy');
    expect(doc.querySelector('a[href="#henry-text-note%3A1"]')).not.toBeNull();
    expect(doc.querySelector('a[href="#henry-text-ref"]')).not.toBeNull();
    expect(doc.querySelector('a[href="#henry-text-legacy"]')).not.toBeNull();
    expect(doc.querySelector('a[href="#henry-text-location"]')).not.toBeNull();
    expect(doc.querySelector('a[href="https://other.test/#ref"]')).not.toBeNull();
    expect(doc.querySelector('a[href="#missing"]')).toBeNull();
    expect(sanitizeReadableHtml(result.html, doc)).toBe(result.html);
  } finally { dom.window.close(); }
});
