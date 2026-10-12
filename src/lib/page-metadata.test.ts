import { expect, test } from 'bun:test';
import { pageMetadata } from '@/src/lib/page-metadata';

test('reuses the loaded article without another remote page fetch', () => {
  expect(pageMetadata('https://example.com/article', {
    url: 'https://example.com/article', title: ' Article title ', content: 'Some\n article   text.',
  })).toEqual({ title: 'Article title', description: 'Some article text.' });
});

test('does not attach stale article metadata after navigation', () => {
  expect(pageMetadata('https://example.com/new', {
    url: 'https://example.com/old', title: 'Old title', content: 'Old content',
  })).toEqual({ title: 'example.com', description: '' });
});

test('supports extension tab titles and limits record field sizes', () => {
  expect(pageMetadata('https://example.com', { url: 'https://example.com/', title: 'Tab title' })).toEqual({ title: 'Tab title', description: '' });
  const metadata = pageMetadata('https://example.com', { url: 'https://example.com', title: 't'.repeat(400), content: 'a'.repeat(1000) });
  expect(metadata.title.length).toBe(300);
  expect(metadata.description.length).toBe(240);
});
