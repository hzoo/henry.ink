import type { YoutubeTranscriptResponse, TranscriptResponse } from "@/src/lib/youtube-transcript-types";
import { getCorsHeaders, optionsResponse } from '@/api/cors';
import {
  CAPTIONS_MAX_BYTES, fetchText, REQUEST_TIMEOUT_MS, WATCH_MAX_BYTES,
  type Fetcher,
} from '@/api/youtube/upstream';

class YoutubeTranscriptError extends Error {
  constructor(message: string) {
    super(`[YoutubeTranscript] 🚨 ${message}`);
  }
}

class YoutubeTranscriptTooManyRequestError extends YoutubeTranscriptError {
  constructor() {
    super(
      'YouTube is receiving too many requests from this IP and now requires solving a captcha to continue'
    );
  }
}

class YoutubeTranscriptVideoUnavailableError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`The video is no longer available (${videoId})`);
  }
}

class YoutubeTranscriptDisabledError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`Transcript is disabled on this video (${videoId})`);
  }
}

class YoutubeTranscriptNotAvailableError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`No transcripts are available for this video (${videoId})`);
  }
}

class YoutubeTranscriptNotAvailableLanguageError extends YoutubeTranscriptError {
  constructor(lang: string, availableLangs: string[], videoId: string) {
    super(
      `No transcripts are available in ${lang} this video (${videoId}). Available languages: ${availableLangs.join(
        ', '
      )}`
    );
  }
}

class YoutubeTranscriptEmptyError extends YoutubeTranscriptError {
  constructor(videoId: string, method: string) {
    super(`The transcript file URL returns an empty response using ${method} (${videoId})`);
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
  const url = new URL(input);
  const allowed = (['www.youtube.com', 'youtube.com'].includes(url.hostname) && url.pathname === '/api/timedtext') ||
    (url.hostname === 'video.google.com' && url.pathname === '/timedtext');
  if (!allowed || url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) {
    throw new Error('Invalid YouTube caption URL');
  }
  return url.href;
}
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)';
const RE_XML_TRANSCRIPT =
  /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

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
      if (e instanceof YoutubeTranscriptEmptyError) {
        return { title, transcript: await this.fetchTranscriptWithInnerTube(videoId, config) };
      } else {
        throw e;
      }
    }
  }

  private async fetchTranscriptWithHtmlScraping(videoPageBody: string, videoId: string, config?: { lang?: string }) {
    const splittedHTML = videoPageBody.split('"captions":');

    if (splittedHTML.length <= 1) {
      if (videoPageBody.includes('class="g-recaptcha"')) {
        throw new YoutubeTranscriptTooManyRequestError();
      }
      if (!videoPageBody.includes('"playabilityStatus":')) {
        throw new YoutubeTranscriptVideoUnavailableError(videoId);
      }
      throw new YoutubeTranscriptDisabledError(videoId);
    }

    const captions = (() => {
      try {
        return JSON.parse(
          splittedHTML[1].split(',"videoDetails')[0].replace('\n', '')
        );
      } catch (e) {
        return undefined;
      }
    })()?.['playerCaptionsTracklistRenderer'];

    const processedTranscript = await this.processTranscriptFromCaptions(
      captions,
      videoId,
      config
    );

    if (!processedTranscript.length) {
      throw new YoutubeTranscriptEmptyError(videoId, 'HTML scraping');
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

    const json = JSON.parse(innerTubeApiBody);
    const captions = json?.captions?.playerCaptionsTracklistRenderer;

    const processedTranscript = await this.processTranscriptFromCaptions(
      captions,
      videoId,
      config
    );

    if (!processedTranscript.length) {
      throw new YoutubeTranscriptEmptyError(videoId, 'InnerTube API');
    }

    return processedTranscript;
  }

  private async processTranscriptFromCaptions(
    captions: any,
    videoId: string,
    config?: { lang?: string }
  ): Promise<TranscriptResponse[]> {
    if (!captions) {
      throw new YoutubeTranscriptDisabledError(videoId);
    }

    if (!Array.isArray(captions.captionTracks) || !captions.captionTracks.length ||
        !captions.captionTracks.every((track: any) => track &&
          typeof track.languageCode === 'string' && typeof track.baseUrl === 'string')) {
      throw new YoutubeTranscriptNotAvailableError(videoId);
    }

    if (
      config?.lang &&
      !captions.captionTracks.some(
        (track: any) => track.languageCode === config?.lang
      )
    ) {
      throw new YoutubeTranscriptNotAvailableLanguageError(
        config?.lang,
        captions.captionTracks.map((track: any) => track.languageCode),
        videoId
      );
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
    const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];
    const languageCode = config?.lang ?? captions.captionTracks[0]?.languageCode;

    return results.map((result) => {
      const duration = Number(result[2]);
      const offset = Number(result[1]);
      if (!result[1].trim() || !result[2].trim() || !Number.isFinite(duration) ||
          !Number.isFinite(offset) || duration < 0 || offset < 0) {
        throw new Error('Invalid YouTube caption timing');
      }
      return { text: result[3], duration, offset, lang: languageCode };
    });
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

function cleanTranscript(transcript: TranscriptResponse[]): TranscriptResponse[] {
  return transcript.map((item) => ({
    ...item,
    text: item.text.replace(/&amp;/g, '&').replace(/&#39;/g, "'")
  }));
}

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
  const cleanedTranscript = cleanTranscript(transcript);

  const response: YoutubeTranscriptResponse = {
    videoId,
    title,
    transcript: cleanedTranscript,
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
    console.error('YouTube transcript error:', error);
    console.error('Details:', error instanceof Error ? error.message : error);
    const response: YoutubeTranscriptResponse = {
      videoId,
      transcript: [],
      error: 'Failed to fetch transcript',
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers,
    });
  } finally {
    clearTimeout(timer);
  }
}
