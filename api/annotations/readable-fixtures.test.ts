import { expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { extractReadableArticle } from '@/henry-ink/reader/readable';
import { readerFixtures } from '@/tests/fixtures/reader';

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

for (const fixture of readerFixtures) {
  test(`${fixture.id}: retains every expected paragraph in order, including the final three`, async () => {
    const host = new JSDOM('');
    try {
      const paragraphs = (document: Document) => [...document.querySelectorAll('p')]
        .map(p => normalize(p.textContent || ''));
      const result = await extractReadableArticle(fixture.archive, fixture.url, host.window.document);
      host.window.document.body.innerHTML = result.html;
      expect(result.title).toBe(fixture.archive.title);
      expect(paragraphs(host.window.document)).toEqual(fixture.expectedParagraphs);
      for (const paragraph of fixture.expectedParagraphs) expect(normalize(result.textContent)).toContain(paragraph);
      expect(normalize(result.textContent).endsWith(fixture.expectedEndingParagraphs[2])).toBe(true);
      expect(host.window.document.querySelector('style, link, [style], font')).toBeNull();
    } finally {
      host.window.close();
    }
  });
}
