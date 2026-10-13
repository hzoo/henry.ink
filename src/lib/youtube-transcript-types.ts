export interface TranscriptResponse {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
}

export type YoutubeTranscriptErrorCode =
  | 'youtube_blocked'
  | 'video_unavailable'
  | 'transcript_unavailable'
  | 'language_unavailable'
  | 'upstream_error'
  | 'upstream_timeout'
  | 'request_cancelled';

export interface YoutubeTranscriptResponse {
  videoId: string;
  title?: string;
  transcript: TranscriptResponse[];
  error?: string;
  errorCode?: YoutubeTranscriptErrorCode;
}
