import type { EmbedProvider } from "@/henry-ink/embed/providers";
import { registerEmbedProvider } from "@/henry-ink/embed/providers";
import type { YoutubeTranscriptResponse } from "@/src/lib/youtube-transcript-types";
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

    const transcriptEndpoint = context.env.transcriptUrl || 'http://localhost:3000/api/youtube/transcript';
    const response = await context.fetch(`${transcriptEndpoint}?${new URLSearchParams({ videoId, lang: 'en' })}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube transcript error: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const youtubeData = await response.json() as YoutubeTranscriptResponse;

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
