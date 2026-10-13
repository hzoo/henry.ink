import { expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { extractReadableArticle } from '@/henry-ink/reader/readable';
import { indexArticle } from '@/src/lib/annotations/anchors';
import { readerFixtures } from '@/tests/fixtures/reader';

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

test('committed reader fixtures cover styled, bare and legacy pages', () => {
  expect(readerFixtures.map(fixture => fixture.id)).toEqual(['custom-styled', 'bare', 'legacy']);
});

for (const fixture of readerFixtures) {
  test(`${fixture.id}: retains every expected paragraph in order, including the final three`, async () => {
    const source = new JSDOM(fixture.archive.html);
    const host = new JSDOM('');
    try {
      expect(fixture.expectedParagraphs.length).toBeGreaterThan(3);
      for (const paragraph of fixture.expectedParagraphs) expect(normalize(paragraph).length).toBeGreaterThan(0);
      expect(fixture.paragraphs).toEqual(fixture.expectedParagraphs);
      expect(fixture.expectedEndingParagraphs).toHaveLength(3);
      expect(fixture.expectedParagraphs.slice(-3)).toEqual(fixture.expectedEndingParagraphs);
      expect(fixture.archive.html.trim().length).toBeGreaterThan(0);
      expect(fixture.archive.textContent.trim().length).toBeGreaterThan(0);

      const paragraphs = (document: Document) => [...document.querySelectorAll('p')]
        .map(p => normalize(p.textContent || ''));
      expect(paragraphs(source.window.document)).toEqual(fixture.expectedParagraphs);

      const result = await extractReadableArticle(fixture.archive, fixture.url, host.window.document);
      host.window.document.body.innerHTML = result.html;
      expect(result.html.trim().length).toBeGreaterThan(0);
      expect(result.textContent.trim().length).toBeGreaterThan(0);
      expect(result.title).toBe(fixture.archive.title);
      expect(paragraphs(host.window.document)).toEqual(fixture.expectedParagraphs);
      expect(paragraphs(host.window.document).slice(-3)).toEqual(fixture.expectedEndingParagraphs);
      for (const paragraph of fixture.expectedParagraphs) expect(normalize(result.textContent)).toContain(paragraph);
      expect(normalize(result.textContent).endsWith(fixture.expectedEndingParagraphs[2])).toBe(true);
      expect(host.window.document.querySelector('style, link, [style], font')).toBeNull();
    } finally {
      source.window.close();
      host.window.close();
    }
  });

  test(`${fixture.id}: smoke note anchors to the final paragraph in source and readable HTML`, async () => {
    const source = new JSDOM(fixture.archive.html);
    const host = new JSDOM('');
    try {
      expect(fixture.marginResponse.items).toHaveLength(1);
      expect(fixture.marginResponse.target).toBe(fixture.url);
      expect(fixture.marginResponse.items[0].target).toBe(fixture.url);
      expect(fixture.marginResponse.items[0].anchor).toEqual(fixture.noteAnchor);
      expect(fixture.noteAnchor.exact).toBe(fixture.expectedEndingParagraphs[2]);
      expect(fixture.noteAnchor.exact.trim().length).toBeGreaterThan(0);

      const result = await extractReadableArticle(fixture.archive, fixture.url, host.window.document);
      host.window.document.body.innerHTML = result.html;
      for (const document of [source.window.document, host.window.document]) {
        const range = indexArticle(document.body)(fixture.noteAnchor);
        expect(range).not.toBeNull();
        expect(normalize(range!.toString())).toBe(fixture.noteAnchor.exact);
        const paragraphs = document.querySelectorAll('p');
        expect(range!.startContainer.parentElement?.closest('p')).toBe(paragraphs[paragraphs.length - 1]);
      }
    } finally {
      source.window.close();
      host.window.close();
    }
  });
}
