import type { EmbedProvider } from "@/henry-ink/embed/providers";
import { apiUrl } from '@/src/lib/api-url';
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

function transcriptErrorMessage(status: number, code?: unknown): string {
  if (code === 'youtube_blocked') return 'YouTube is blocking transcript requests. Try again later.';
  if (code === 'upstream_timeout') return 'The transcript request timed out. Try again.';
  if (code === 'video_unavailable') return 'This video is unavailable.';
  if (code === 'language_unavailable') return 'No English transcript is available for this video.';
  if (status === 404 || code === 'transcript_unavailable') return 'No transcript is available for this video.';
  if (status === 429) return 'Transcript requests are limited. Try again later.';
  return 'The transcript could not be loaded. You can still watch the video.';
}

export const youtubeEmbedProvider: EmbedProvider = {
  id: 'youtube',
  matches: isYouTubeUrl,
  fetchContent: async (url, context) => {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL - could not extract video ID');
    }

    const transcriptEndpoint = context.env.transcriptUrl || apiUrl('/api/youtube/transcript');
    let response: Response;
    try {
      response = await context.fetch(`${transcriptEndpoint}?${new URLSearchParams({ videoId, lang: 'en' })}`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new Error('The transcript service could not be reached. Try again.');
    }
    const youtubeData = await response.json().catch(() => null) as YoutubeTranscriptResponse | null;
    if (!response.ok || !youtubeData || youtubeData.error || !Array.isArray(youtubeData.transcript)) {
      throw new Error(transcriptErrorMessage(response.status, youtubeData?.errorCode));
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
