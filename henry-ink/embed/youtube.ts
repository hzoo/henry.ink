import type { EmbedProvider } from "@/henry-ink/embed/providers";
import { registerEmbedProvider } from "@/henry-ink/embed/providers";
import type { YoutubeWorkerResponse } from "@/src/lib/youtube-transcript-worker";
import type { YouTubeEmbed } from "@/henry-ink/signals";

const RE_YOUTUBE =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/embed\/)([^"&?\/\s]{11})/i;

export function isYouTubeUrl(url: string): boolean {
  return RE_YOUTUBE.test(url);
}

export function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(RE_YOUTUBE);
  return match ? match[1] : null;
}

export const youtubeEmbedProvider: EmbedProvider = {
  id: 'youtube',
  matches: isYouTubeUrl,
  fetchContent: async (url, context) => {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL - could not extract video ID');
    }

    const youtubeWorkerUrl = context.env.youtubeWorkerUrl || 'http://localhost:8789';
    const response = await context.fetch(`${youtubeWorkerUrl}?${new URLSearchParams({ videoId, lang: 'en' })}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube worker error: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const youtubeData = await response.json() as YoutubeWorkerResponse;

    if (youtubeData.error) {
      throw new Error(youtubeData.error);
    }

    const textContent = youtubeData.transcript
      .map((item) => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const embed: YouTubeEmbed = {
      provider: 'youtube',
      originalUrl: url,
      videoId: youtubeData.videoId,
      title: youtubeData.title || `YouTube Video ${videoId}`,
      transcript: youtubeData.transcript,
      textContent,
    };

    return embed;
  },
};

registerEmbedProvider(youtubeEmbedProvider);
