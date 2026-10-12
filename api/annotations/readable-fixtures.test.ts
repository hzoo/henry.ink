import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { extractReadableArticle } from '@/henry-ink/reader/readable';

// Optional offline captures supplied for fidelity checks. Never fetch a live site.
const directory = process.env.ARCHIVE_BASELINE_DIR || '/tmp/henry-archive-baseline';
const fixtures = [
  { name: 'robin', selector: 'main' },
  { name: 'spatial', selector: 'body' },
  { name: 'detail', selector: '.post' },
  { name: 'conversations', selector: 'article .body.markup' },
  { name: 'garden', selector: '.single-post__content' },
  { name: 'church', selector: '.post' },
  { name: 'tyranny', selector: 'body' },
];
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

for (const { name, selector } of fixtures) {
  const path = `${directory}/${name}.json`;
  test.skipIf(!existsSync(path))(`offline ${name}: compare article paragraphs, including the final three`, async () => {
    const fixture = await Bun.file(path).json();
    const source = new JSDOM(fixture.archive.html);
    const host = new JSDOM('');
    try {
      const article = source.window.document.querySelector(selector)!;
      expect(article).not.toBeNull();
      const paragraphs = [...article.querySelectorAll('p')]
        .filter(p => !p.closest('.preamble')) // subscription CTA, not article prose
        .map(p => normalize(p.textContent || '')).filter(text => text.length > 20);
      const result = await extractReadableArticle(fixture.archive, fixture.url, host.window.document);
      const text = normalize(result.textContent);
      const missing = paragraphs.filter(paragraph => !text.includes(paragraph));
      // Spatial's interactive room status is UI, not part of its essay.
      expect(missing).toEqual(name === 'spatial' ? ['The room is temporarily disabled.'] : []);
      for (const ending of paragraphs.slice(-3)) expect(text).toContain(ending);
      console.info(`${name}: ${paragraphs.length - missing.length}/${paragraphs.length} paragraphs; final 3 retained`);
    } finally {
      source.window.close();
      host.window.close();
    }
  });
}
