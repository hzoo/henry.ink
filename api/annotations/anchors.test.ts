import { describe, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { indexArticle, sameArticle, matchesArticleTarget } from '@/src/lib/annotations/anchors';

function article(html: string) {
  return new JSDOM(`<body>${html}</body>`).window.document.body;
}

describe('reader quote anchoring', () => {
  test('accepts an observed redirect without guessing slash or query equivalence', () => {
    const requested = 'https://www.robinsloan.com/notes/home-cooked-app';
    const resolved = `${requested}/`;
    expect(matchesArticleTarget(resolved, requested)).toBe(false);
    expect(matchesArticleTarget(resolved, requested, resolved)).toBe(true);
    expect(matchesArticleTarget(`${requested}#quote`, requested, resolved)).toBe(true);
    expect(matchesArticleTarget(`${resolved}?version=other`, requested, resolved)).toBe(false);
    expect(matchesArticleTarget('https://other.example/article', requested, resolved)).toBe(false);
  });
  test('matches across inline markup without changing the source DOM', () => {
    const root = article('<p>Before a <em>quoted</em> passage after.</p>');
    const before = root.innerHTML;
    const range = indexArticle(root)({ exact: 'a quoted passage', prefix: 'Before ', suffix: ' after.' });
    expect(range?.toString()).toBe('a quoted passage');
    expect(root.innerHTML).toBe(before);
  });
  test('rejects repeated quotes unless surrounding context uniquely identifies one', () => {
    const find = indexArticle(article('<p>First repeated phrase.</p><p>Second repeated phrase.</p>'));
    expect(find({ exact: 'repeated phrase' })).toBeNull();
    const range = find({ exact: 'repeated phrase', prefix: 'Second ' });
    expect(range?.startContainer.parentElement?.textContent).toBe('Second repeated phrase.');
  });
  test('normalizes whitespace and retains correct DOM offsets', () => {
    const range = indexArticle(article('<p>  A\n\t quoted <strong> passage</strong>  ends.</p>'))({ exact: 'A quoted passage' });
    expect(range?.toString().replace(/\s+/g, ' ')).toBe('A quoted passage');
  });
  test('adds a text boundary between adjacent paragraphs', () => {
    const range = indexArticle(article('<p>First sentence.</p><p>Next sentence.</p>'))({ exact: 'sentence. Next' });
    expect(range?.startContainer.parentElement?.tagName).toBe('P');
    expect(range?.endContainer.textContent).toBe('Next sentence.');
  });
  test('excludes scripts, navigation, hidden text, and unmatched quotes', () => {
    const find = indexArticle(article('<nav>Not content</nav><script>Danger</script><p hidden>Hidden</p><p>Real text</p>'));
    for (const exact of ['Not content', 'Danger', 'Hidden', 'missing', '']) expect(find({ exact })).toBeNull();
    expect(find({ exact: 'Real text' })?.toString()).toBe('Real text');
  });
  test('does not fold case or unrelated URL query parameters', () => {
    expect(indexArticle(article('<p>Case sensitive</p>'))({ exact: 'case sensitive' })).toBeNull();
    expect(sameArticle('https://example.com/a#one', 'https://example.com/a#two')).toBe(true);
    expect(sameArticle('https://example.com/a?id=1', 'https://example.com/a?id=2')).toBe(false);
    expect(sameArticle('https://example.com/a', 'https://other.example/a')).toBe(false);
  });
  test('excludes CSS-hidden copies and treats line breaks as spaces', () => {
    const root = article('<p style="display:none">Hello world</p><p>Hello<br>world</p>');
    const range = indexArticle(root)({ exact: 'Hello world' });
    expect(range).not.toBeNull();
    expect(range?.startContainer.parentElement?.hasAttribute('style')).toBe(false);
    expect(range?.endContainer.textContent).toBe('world');
  });
});
