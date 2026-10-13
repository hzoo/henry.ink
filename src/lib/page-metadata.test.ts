import { expect, test } from 'bun:test';
import { pageMetadata } from '@/src/lib/page-metadata';

test('trims the title and normalizes content whitespace for a matching URL', () => {
  expect(pageMetadata('https://example.com/article', {
    url: 'https://example.com/article', title: ' Article title ', content: 'Some\n article   text.',
  })).toEqual({ title: 'Article title', description: 'Some article text.' });
});

test('returns the target hostname and an empty description when article URLs differ', () => {
  expect(pageMetadata('https://example.com/new', {
    url: 'https://example.com/old', title: 'Old title', content: 'Old content',
  })).toEqual({ title: 'example.com', description: '' });
});

test('matches normalized URLs and uses an empty description when content is absent', () => {
  expect(pageMetadata('https://example.com', { url: 'https://example.com/', title: 'Tab title' })).toEqual({ title: 'Tab title', description: '' });
});

test('limits the title to 300 characters and the description to 240 characters', () => {
  const metadata = pageMetadata('https://example.com', { url: 'https://example.com', title: 't'.repeat(400), content: 'a'.repeat(1000) });
  expect(metadata.title.length).toBe(300);
  expect(metadata.description.length).toBe(240);
});
