import { expect, test } from 'bun:test';
import { extractYouTubeVideoId, isYouTubeUrl, youtubeEmbedProvider } from '@/henry-ink/embed/youtube';

const id = 'H4LosXgKX4g';

test('YouTube embeds are constructed synchronously without transcript content or transport', () => {
  const url = `https://www.youtube.com/watch?v=${id}`;
  expect(youtubeEmbedProvider.createContent(url)).toEqual({ provider: 'youtube', originalUrl: url, videoId: id });
});

test('supported YouTube URLs retain the exact video ID', () => {
  for (const url of [
    `https://www.youtube.com/watch?v=${id}&t=30`, `https://youtu.be/${id}?t=30`,
    `https://m.youtube.com/watch?v=${id}`, `https://music.youtube.com/watch?v=${id}`,
    `https://youtube.com/shorts/${id}`, `https://youtube.com/live/${id}`,
    `https://youtube.com/embed/${id}`,
  ]) {
    expect(extractYouTubeVideoId(url)).toBe(id);
    expect(isYouTubeUrl(url)).toBe(true);
  }
});

test('lookalike domains and malformed video URLs are not treated as embeds', () => {
  for (const url of [
    `https://notyoutube.com/watch?v=${id}`, `https://youtube.com.evil.test/watch?v=${id}`,
    `https://example.com/youtube.com/watch?v=${id}`, `https://youtube.com@evil.test/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}extra`, 'https://youtube.com/watch?v=short',
    `ftp://youtube.com/watch?v=${id}`, 'not a URL',
  ]) {
    expect(isYouTubeUrl(url)).toBe(false);
    expect(() => youtubeEmbedProvider.createContent(url)).toThrow('Invalid YouTube video URL');
  }
});
