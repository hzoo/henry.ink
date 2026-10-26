import { describe, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { indexArticle, sameArticle, matchesArticleTarget } from '@/src/lib/annotations/anchors';
import { enhanceArenaLinks } from '@/henry-ink/reader/arena-enhancement';

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
  test('keeps quote text and placement across generated Are.na links', () => {
    const root = article('<p>Shared tools belong on this shelf.</p>');
    enhanceArenaLinks(root, [{ slug: 'shared-tools', title: 'Shared tools', matchedText: 'Shared tools', url: 'https://are.na/channels/shared-tools', author_name: 'Reader', contents_count: 2 }]);
    const range = indexArticle(root)({ exact: 'Shared tools belong on this shelf.' });
    expect(range?.startContainer.textContent).toBe('Shared tools');
    expect(range?.endContainer.textContent).toBe(' belong on this shelf.');
    expect(range?.endOffset).toBe(' belong on this shelf.'.length);
    expect(range?.toString()).toBe('Shared tools belong on this shelf.');
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
  test('prunes hidden ancestors but permits children that restore visibility', () => {
    const root = article('<div style="display:none"><p>Hidden display copy</p></div><div style="opacity:0"><p style="opacity:1">Hidden opacity copy</p></div><div aria-hidden="true"><p>Hidden accessibility copy</p></div><div style="visibility:hidden">Hidden text<p style="visibility:visible">Visible override</p></div><p>Readable end</p>');
    const find = indexArticle(root);
    for (const exact of ['Hidden display copy', 'Hidden opacity copy', 'Hidden accessibility copy', 'Hidden text']) expect(find({ exact })).toBeNull();
    expect(find({ exact: 'Visible override' })?.toString()).toBe('Visible override');
    expect(find({ exact: 'Readable end' })?.toString()).toBe('Readable end');
    root.style.display = 'none';
    expect(indexArticle(root)({ exact: 'Readable end' })).toBeNull();
  });
  test('maps late endpoints across empty text nodes and block boundaries', () => {
    const root = article(`${'<p>Supporting text</p>'.repeat(200)}<p> \n </p><p>Prefix <em>late</em> quote</p><p>next block.</p>`);
    const range = indexArticle(root)({ exact: 'late quote next', prefix: 'Prefix ', suffix: ' block.' });
    expect(range?.startContainer.textContent).toBe('late');
    expect(range?.startOffset).toBe(0);
    expect(range?.endContainer.textContent).toBe('next block.');
    expect(range?.endOffset).toBe(4);
    expect(indexArticle(root)({ exact: 'Supporting text' })).toBeNull();
  });
});
