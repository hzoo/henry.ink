import type { EmbedProvider } from '@/henry-ink/embed/providers';
import { registerEmbedProvider } from '@/henry-ink/embed/providers';

export function extractYouTubeVideoId(input: string): string | null {
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    let id: string | null = null;
    if (url.hostname === 'youtu.be') id = url.pathname.match(/^\/([\w-]{11})\/?$/)?.[1] ?? null;
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v')
        : url.pathname.match(/^\/(?:embed|shorts|live|v|e)\/([\w-]{11})\/?$/)?.[1] ?? null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

export const youtubeEmbedProvider: EmbedProvider = {
  id: 'youtube',
  matches: isYouTubeUrl,
  createContent(url) {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) throw new Error('Invalid YouTube video URL');
    return { provider: 'youtube', originalUrl: url, videoId };
  },
};

registerEmbedProvider(youtubeEmbedProvider);
