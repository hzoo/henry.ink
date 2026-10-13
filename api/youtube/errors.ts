import type { YoutubeTranscriptErrorCode } from '@/src/lib/youtube-transcript-types';

export class TranscriptError extends Error {
  constructor(
    public readonly code: YoutubeTranscriptErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'TranscriptError';
  }
}

export function upstreamError(): TranscriptError {
  return new TranscriptError('upstream_error', 502, 'YouTube returned an unreadable transcript response.');
}

export function blockedError(status = 503): TranscriptError {
  return new TranscriptError('youtube_blocked', status, 'YouTube is blocking transcript requests from this server.');
}
