import { expect, test } from 'bun:test';
import { discussionShareUrl, sourceFromReaderPath, withReaderParams } from '@/henry-ink/reader/url';

test('reader controls do not become part of the requested source URL', () => {
  expect(sourceFromReaderPath('/https://example.com/article?token=a%2Fb&post=3abc&token=2+3&channel=reading&block=42'))
    .toBe('https://example.com/article?token=a%2Fb&token=2+3');
  expect(sourceFromReaderPath('/example.com/article?lang=en#ending')).toBe('example.com/article?lang=en#ending');
  expect(sourceFromReaderPath('/')).toBe('');
});

test('discussion links append their control before a fragment and preserve source query bytes', () => {
  expect(discussionShareUrl('https://example.com/article?signature=a%2Fb%20c&tag=a+b#ending', '3abc'))
    .toBe('https://henry.ink/https://example.com/article?signature=a%2Fb%20c&tag=a+b&post=3abc#ending');
  expect(discussionShareUrl('https://example.com/article', '3abc'))
    .toBe('https://henry.ink/https://example.com/article?post=3abc');
});

test('changing reader state replaces all occurrences while leaving unrelated query fields untouched', () => {
  const reader = '/https://example.com/article?tag=a%20b&post=old&%70ost=older&channel=before&block=1#ending';
  const channel = withReaderParams(reader, { channel: 'after', block: null });
  expect(channel).toBe('/https://example.com/article?tag=a%20b&post=old&%70ost=older&channel=after#ending');
  expect(withReaderParams(channel, { post: 'new' }))
    .toBe('/https://example.com/article?tag=a%20b&channel=after&post=new#ending');
  expect(withReaderParams('/https://example.com/article?channel=before', { channel: null }))
    .toBe('/https://example.com/article');
});
