import type { YoutubeTranscriptResponse, TranscriptResponse } from "@/src/lib/youtube-transcript-types";
import { getCorsHeaders, optionsResponse } from '@/api/cors';
import { TranscriptError, upstreamError } from '@/api/youtube/errors';
import { checkPlayability, parseTranscript, playerField } from '@/api/youtube/parsing';
import {
  CAPTIONS_MAX_BYTES, fetchText, REQUEST_TIMEOUT_MS, WATCH_MAX_BYTES,
  type Fetcher,
} from '@/api/youtube/upstream';

class EmptyTranscriptError extends TranscriptError {
  constructor() {
    super('transcript_unavailable', 404, 'YouTube did not provide transcript text for this video.');
  }
}

const RE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const RE_LANGUAGE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

function retrieveVideoId(input: string): string | undefined {
  if (RE_VIDEO_ID.test(input)) return input;
  if (input.length > 2048) return undefined;
  try {
    // Keep accepting bare youtube.com/... and youtu.be/... links.
    const url = new URL(input.includes('://') ? input : `https://${input}`);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return undefined;
    let id: string | null | undefined;
    if (url.hostname === 'youtu.be') {
      id = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
    } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') :
        url.pathname.match(/^\/(?:embed|shorts|live|v|e)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
    }
    return id && RE_VIDEO_ID.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

function validateCaptionUrl(input: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw upstreamError(); }
  const allowed = (['www.youtube.com', 'youtube.com'].includes(url.hostname) && url.pathname === '/api/timedtext') ||
    (url.hostname === 'video.google.com' && url.pathname === '/timedtext');
  if (!allowed || url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) {
    throw upstreamError();
  }
  return url.href;
}
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)';

class YoutubeTranscript {
  constructor(private fetcher: Fetcher, private signal: AbortSignal) {}

  public async fetchTranscript(
    videoId: string,
    config?: { lang?: string }
  ): Promise<{ transcript: TranscriptResponse[]; title?: string }> {
    const videoPageBody = await fetchText(
      `https://www.youtube.com/watch?v=${videoId}`,
      { headers: {
        ...(config?.lang && { 'Accept-Language': config.lang }),
        'User-Agent': USER_AGENT,
      } },
      WATCH_MAX_BYTES, this.signal, this.fetcher,
    );
    const title = getVideoTitle(videoPageBody);
    try {
      return { title, transcript: await this.fetchTranscriptWithHtmlScraping(videoPageBody, videoId, config) };
    } catch (e) {
      if (e instanceof EmptyTranscriptError) {
        return { title, transcript: await this.fetchTranscriptWithInnerTube(videoId, config) };
      } else {
        throw e;
      }
    }
  }

  private async fetchTranscriptWithHtmlScraping(videoPageBody: string, videoId: string, config?: { lang?: string }) {
    const playability = playerField(videoPageBody, 'playabilityStatus');
    checkPlayability(playability, videoPageBody);
    const captionData = playerField(videoPageBody, 'captions');
    if (captionData === undefined && playability?.status !== 'OK') throw upstreamError();
    const captions = captionData?.playerCaptionsTracklistRenderer;

    const processedTranscript = await this.processTranscriptFromCaptions(
      captions,
      videoId,
      config
    );

    if (!processedTranscript.length) {
      throw new EmptyTranscriptError();
    }

    return processedTranscript;
  }

  private async fetchTranscriptWithInnerTube(
    videoId: string,
    config?: { lang?: string }
  ): Promise<TranscriptResponse[]> {
    const options = {
      method: 'POST',
      headers: {
        ...(config?.lang && { 'Accept-Language': config.lang }),
        'Content-Type': 'application/json',
        Origin: 'https://www.youtube.com',
        Referer: `https://www.youtube.com/watch?v=${videoId}`
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20250312.04.00',
            userAgent: USER_AGENT
          }
        },
        videoId,
      }),
    } satisfies RequestInit;

    const innerTubeApiBody = await fetchText(
      'https://www.youtube.com/youtubei/v1/player',
      options, CAPTIONS_MAX_BYTES, this.signal, this.fetcher,
    );

    let json;
    try { json = JSON.parse(innerTubeApiBody); } catch { throw upstreamError(); }
    if (!json || typeof json !== 'object') throw upstreamError();
    checkPlayability(json.playabilityStatus);
    if (!json.captions && json.playabilityStatus?.status !== 'OK') throw upstreamError();
    const captions = json?.captions?.playerCaptionsTracklistRenderer;

    const processedTranscript = await this.processTranscriptFromCaptions(
      captions,
      videoId,
      config
    );

    if (!processedTranscript.length) {
      throw new EmptyTranscriptError();
    }

    return processedTranscript;
  }

  private async processTranscriptFromCaptions(
    captions: any,
    videoId: string,
    config?: { lang?: string }
  ): Promise<TranscriptResponse[]> {
    if (!captions) {
      throw new TranscriptError('transcript_unavailable', 404, 'YouTube does not list captions for this video.');
    }

    if (captions.captionTracks === undefined || (Array.isArray(captions.captionTracks) && !captions.captionTracks.length)) {
      throw new TranscriptError('transcript_unavailable', 404, 'YouTube does not list captions for this video.');
    }
    if (!Array.isArray(captions.captionTracks) || !captions.captionTracks.every((track: any) => track &&
          typeof track.languageCode === 'string' && typeof track.baseUrl === 'string')) {
      throw upstreamError();
    }

    if (
      config?.lang &&
      !captions.captionTracks.some(
        (track: any) => track.languageCode === config?.lang
      )
    ) {
      throw new TranscriptError('language_unavailable', 404, 'YouTube does not list captions in the requested language.');
    }

    const transcriptURL = (
      config?.lang
        ? captions.captionTracks.find(
            (track: any) => track.languageCode === config?.lang
          )
        : captions.captionTracks[0]
    ).baseUrl;

    const transcriptBody = await fetchText(validateCaptionUrl(transcriptURL), {
      headers: {
        ...(config?.lang && { 'Accept-Language': config.lang }),
        'User-Agent': USER_AGENT,
      },
    }, CAPTIONS_MAX_BYTES, this.signal, this.fetcher);
    const languageCode = config?.lang ?? captions.captionTracks[0]?.languageCode;
    return parseTranscript(transcriptBody, languageCode);
  }
}

function getVideoTitle(html: string): string | undefined {
  const titleMatches = [
    html.match(/<meta property="og:title" content="([^"]+)"/),
    html.match(/<meta name="title" content="([^"]+)"/),
    html.match(/<title>([^<]+)<\/title>/),
  ];

  for (const match of titleMatches) {
    if (match) {
      return match[1].replace(' - YouTube', '').trim();
    }
  }
  return undefined;
}

// Bounded cache: max 200 entries, 1 hour TTL
const MAX_CACHE_SIZE = 200;
const inMemoryCache = new Map<string, { data: YoutubeTranscriptResponse; expires: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchTranscriptData(videoId: string, lang: string, signal: AbortSignal, fetcher: Fetcher): Promise<YoutubeTranscriptResponse> {
  signal.throwIfAborted();
  const cacheKey = `${videoId}:${lang}`;
  const now = Date.now();
  const cached = inMemoryCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  const { transcript, title } = await new YoutubeTranscript(fetcher, signal).fetchTranscript(videoId, { lang });
  signal.throwIfAborted();

  const response: YoutubeTranscriptResponse = {
    videoId,
    title,
    transcript,
  };

  // Remove expired entries on writes; no process-wide cleanup timer is needed.
  const completedAt = Date.now();
  for (const [key, entry] of inMemoryCache) {
    if (entry.expires <= completedAt) inMemoryCache.delete(key);
  }
  // Evict oldest if at capacity.
  if (inMemoryCache.size >= MAX_CACHE_SIZE) {
    const oldest = inMemoryCache.keys().next().value;
    if (oldest) inMemoryCache.delete(oldest);
  }
  inMemoryCache.set(cacheKey, {
    data: response,
    expires: completedAt + CACHE_TTL_MS,
  });

  return response;
}

export { optionsResponse as youtubeTranscriptOptionsRoute };

export async function youtubeTranscriptRoute(req: Request, fetcher: Fetcher = fetch): Promise<Response> {
  const requestUrl = new URL(req.url);
  const origin = req.headers.get('Origin') || '';
  const headers = {
    ...getCorsHeaders(origin),
    'Content-Type': 'application/json',
  };

  const videoId = requestUrl.searchParams.get('videoId');
  const lang = requestUrl.searchParams.get('lang') || 'en';

  if (!videoId) {
    return new Response(
      JSON.stringify({ error: 'Missing videoId parameter' }),
      { status: 400, headers }
    );
  }

  const identifier = retrieveVideoId(videoId);
  if (!identifier || lang.length > 64 || !RE_LANGUAGE.test(lang)) {
    return new Response(JSON.stringify({
      videoId, transcript: [], error: !identifier ? 'Invalid videoId parameter' : 'Invalid lang parameter',
    }), { status: 400, headers });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const signal = AbortSignal.any([req.signal, controller.signal]);
  try {
    const data = await fetchTranscriptData(identifier, lang, signal, fetcher);
    // Cache by canonical ID, but preserve the caller's videoId in the response.
    return new Response(JSON.stringify({ ...data, videoId }), {
      status: 200,
      headers: {
        ...headers,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    const failure = controller.signal.aborted
      ? new TranscriptError('upstream_timeout', 504, 'YouTube took too long to return a transcript.')
      : req.signal.aborted
        ? new TranscriptError('request_cancelled', 408, 'The transcript request was cancelled.')
        : error instanceof TranscriptError ? error : undefined;
    // Never log upstream bodies or signed caption URLs.
    console.error('YouTube transcript request failed:', identifier, failure?.code ?? 'internal_error');
    const response: YoutubeTranscriptResponse = {
      videoId,
      transcript: [],
      error: failure?.message ?? 'Failed to fetch transcript',
      ...(failure && { errorCode: failure.code }),
    };

    return new Response(JSON.stringify(response), {
      status: failure?.status ?? 500,
      headers: { ...headers, 'Cache-Control': 'no-store' },
    });
  } finally {
    clearTimeout(timer);
  }
}
