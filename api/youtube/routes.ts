import type { YoutubeTranscriptResponse, TranscriptResponse } from "@/src/lib/youtube-transcript-types";
import { getCorsHeaders, optionsResponse } from '../cors';

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

const RE_YOUTUBE =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)';
const RE_XML_TRANSCRIPT =
  /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

class YoutubeTranscript {
  public static async fetchTranscript(
    videoId: string,
    config?: { lang?: string }
  ): Promise<TranscriptResponse[]> {
    try {
      return await this.fetchTranscriptWithHtmlScraping(videoId, config);
    } catch (e) {
      if (e instanceof YoutubeTranscriptEmptyError) {
        return await this.fetchTranscriptWithInnerTube(videoId, config);
      } else {
        throw e;
      }
    }
  }

  private static async fetchTranscriptWithHtmlScraping(videoId: string, config?: { lang?: string }) {
    const identifier = this.retrieveVideoId(videoId);
    const videoPageResponse = await fetch(
      `https://www.youtube.com/watch?v=${identifier}`,
      {
        headers: {
          ...(config?.lang && { 'Accept-Language': config.lang }),
          'User-Agent': USER_AGENT,
        },
      }
    );
    const videoPageBody = await videoPageResponse.text();

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

  private static async fetchTranscriptWithInnerTube(
    videoId: string,
    config?: { lang?: string }
  ): Promise<TranscriptResponse[]> {
    const identifier = this.retrieveVideoId(videoId);
    const options = {
      method: 'POST',
      headers: {
        ...(config?.lang && { 'Accept-Language': config.lang }),
        'Content-Type': 'application/json',
        Origin: 'https://www.youtube.com',
        Referer: `https://www.youtube.com/watch?v=${identifier}`
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20250312.04.00',
            userAgent: USER_AGENT
          }
        },
        videoId: identifier,
      }),
    } satisfies RequestInit;

    const innerTubeApiResponse = await fetch(
      'https://www.youtube.com/youtubei/v1/player',
      options
    );

    const json = await innerTubeApiResponse.json();
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

  private static async processTranscriptFromCaptions(
    captions: any,
    videoId: string,
    config?: { lang?: string }
  ): Promise<TranscriptResponse[]> {
    if (!captions) {
      throw new YoutubeTranscriptDisabledError(videoId);
    }

    if (!('captionTracks' in captions)) {
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

    const transcriptResponse = await fetch(transcriptURL, {
      headers: {
        ...(config?.lang && { 'Accept-Language': config.lang }),
        'User-Agent': USER_AGENT,
      },
    });
    if (!transcriptResponse.ok) {
      throw new YoutubeTranscriptNotAvailableError(videoId);
    }
    const transcriptBody = await transcriptResponse.text();
    const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];
    const languageCode = config?.lang ?? captions.captionTracks[0]?.languageCode;

    return results.map((result) => ({
      text: result[3],
      duration: parseFloat(result[2]),
      offset: parseFloat(result[1]),
      lang: languageCode,
    }));
  }

  private static retrieveVideoId(videoId: string) {
    if (videoId.length === 11) {
      return videoId;
    }
    const matchId = videoId.match(RE_YOUTUBE);
    if (matchId && matchId.length) {
      return matchId[1];
    }
    throw new YoutubeTranscriptError(
      'Impossible to retrieve Youtube video ID.'
    );
  }
}

async function getVideoTitle(videoId: string): Promise<string | undefined> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    const html = await response.text();

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
  } catch (e) {
    console.warn('Failed to extract video title:', e);
  }
  return undefined;
}

// Bounded cache: max 200 entries, 1 hour TTL
const MAX_CACHE_SIZE = 200;
const inMemoryCache = new Map<string, { data: YoutubeTranscriptResponse; expires: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Periodic cleanup of expired entries (not on hot path)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of inMemoryCache) {
    if (v.expires <= now) inMemoryCache.delete(k);
  }
}, CACHE_TTL_MS);

function cleanTranscript(transcript: TranscriptResponse[]): TranscriptResponse[] {
  return transcript.map((item) => ({
    ...item,
    text: item.text.replace(/&amp;/g, '&').replace(/&#39;/g, "'")
  }));
}

async function fetchTranscriptData(videoId: string, lang: string): Promise<YoutubeTranscriptResponse> {
  const cacheKey = `${videoId}:${lang}`;
  const now = Date.now();
  const cached = inMemoryCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
  const cleanedTranscript = cleanTranscript(transcript);
  const title = await getVideoTitle(videoId);

  const response: YoutubeTranscriptResponse = {
    videoId,
    title,
    transcript: cleanedTranscript,
  };

  // Evict oldest if at capacity (expired entries cleaned by interval)
  if (inMemoryCache.size >= MAX_CACHE_SIZE) {
    const oldest = inMemoryCache.keys().next().value;
    if (oldest) inMemoryCache.delete(oldest);
  }
  inMemoryCache.set(cacheKey, {
    data: response,
    expires: now + CACHE_TTL_MS,
  });

  return response;
}

export { optionsResponse as youtubeTranscriptOptionsRoute };

export async function youtubeTranscriptRoute(req: Request): Promise<Response> {
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

  try {
    const data = await fetchTranscriptData(videoId, lang);
    return new Response(JSON.stringify(data), {
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
  }
}
