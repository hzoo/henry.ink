export interface TranscriptResponse {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
}

export interface YoutubeTranscriptResponse {
  videoId: string;
  title?: string;
  transcript: TranscriptResponse[];
  error?: string;
}
