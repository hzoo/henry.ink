import { expect, test } from 'bun:test';
import { youtubeEmbedProvider } from '@/henry-ink/embed/youtube';

const url = 'https://www.youtube.com/watch?v=H4LosXgKX4g';
const load = (response: Response) => youtubeEmbedProvider.fetchContent(url, {
  fetch: Object.assign(async () => response, { preconnect: fetch.preconnect }), env: { transcriptUrl: 'https://api.example/api/youtube/transcript' },
});

test('transcript errors show stable actionable copy, never upstream bodies', async () => {
  for (const [status, errorCode, message] of [
    [503, 'youtube_blocked', 'YouTube is blocking transcript requests. Try again later.'],
    [504, 'upstream_timeout', 'The transcript request timed out. Try again.'],
    [404, 'transcript_unavailable', 'No transcript is available for this video.'],
    [404, 'language_unavailable', 'No English transcript is available for this video.'],
    [404, 'video_unavailable', 'This video is unavailable.'],
    [429, undefined, 'Transcript requests are limited. Try again later.'],
    [500, undefined, 'The transcript could not be loaded. You can still watch the video.'],
  ] as const) {
    await expect(load(Response.json({ error: 'private upstream details', errorCode }, { status }))).rejects.toThrow(message);
  }
});

test('malformed responses and network failures do not leak implementation errors', async () => {
  for (const body of ['Bad Gateway from upstream', 'null', '{}']) {
    await expect(load(new Response(body))).rejects.toThrow('The transcript could not be loaded.');
  }
  await expect(youtubeEmbedProvider.fetchContent(url, {
    fetch: Object.assign(async () => { throw new TypeError('internal host unavailable'); }, { preconnect: fetch.preconnect }), env: {},
  })).rejects.toThrow('The transcript service could not be reached. Try again.');
});

test('successful transcript remains available to reading and highlighting', async () => {
  const result = await load(Response.json({ videoId: 'H4LosXgKX4g', title: 'Fixture',
    transcript: [{ text: 'Hello world', offset: 0, duration: 2 }] }));
  expect(result.textContent).toBe('Hello world');
  expect(result.transcript).toHaveLength(1);
  expect(result.title).toBe('Fixture');
});
