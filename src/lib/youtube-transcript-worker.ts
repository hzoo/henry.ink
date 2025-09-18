/// <reference types="@cloudflare/workers-types" />

export interface Env {
	YOUTUBE_TRANSCRIPT_CACHE: KVNamespace;
}

// YouTube transcript response interfaces
export interface TranscriptResponse {
	text: string;
	duration: number;
	offset: number;
	lang?: string;
}

export interface YoutubeWorkerResponse {
	videoId: string;
	title?: string;
	transcript: TranscriptResponse[];
	error?: string;
}

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

// Helper to create responses with CORS headers
const corsResponse = (body: string, options: ResponseInit = {}) => {
	return new Response(body, {
		...options,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
			"Content-Type": "application/json",
			...options.headers,
		},
	});
};

/**
 * Class to retrieve transcript if exist
 */
class YoutubeTranscript {
	/**
	 * Fetch transcript from YTB Video
	 * @param videoId Video url or video identifier
	 * @param config Get transcript in a specific language ISO
	 */
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

	/**
	 * Fetch transcript from YTB Video using HTML scraping
	 * @param videoId Video url or video identifier
	 * @param config Get transcript in a specific language ISO
	 */
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

	/**
	 * Fetch transcript from YTB Video using InnerTube API
	 * @param videoId Video url or video identifier
	 * @param config Get transcript in a specific language ISO
	 */
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
		}

		const InnerTubeApiResponse = await fetch(
			'https://www.youtube.com/youtubei/v1/player',
			options
		);

		const { captions: { playerCaptionsTracklistRenderer: captions } } = await InnerTubeApiResponse.json();

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

	/**
	 * Process transcript from data captions
	 * @param captions Data captions
	 * @param videoId Video url or video identifier
	 * @param config Get transcript in a specific language ISO
	 */
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
		return results.map((result) => ({
			text: result[3],
			duration: parseFloat(result[2]),
			offset: parseFloat(result[1]),
			lang: config?.lang ?? captions.captionTracks[0].languageCode,
		}));
	}

	/**
	 * Retrieve video id from url or string
	 * @param videoId video url or video id
	 */
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

// Extract video title from YouTube page
async function getVideoTitle(videoId: string): Promise<string | undefined> {
	try {
		const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
			headers: { 'User-Agent': USER_AGENT },
		});
		const html = await response.text();

		// Try to extract title from various meta tags
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

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return corsResponse("", {
				status: 204,
				headers: { "Access-Control-Max-Age": "86400" },
			});
		}

		// Extract video ID from query params
		const url = new URL(request.url);
		const videoId = url.searchParams.get('videoId');
		const lang = url.searchParams.get('lang') || 'en';

		if (!videoId) {
			return corsResponse(JSON.stringify({
				error: "Missing videoId parameter"
			}), { status: 400 });
		}

		const cacheKey = `youtube-transcript:${videoId}:${lang}`;

		// Check cache first
		try {
			const cachedData = await env.YOUTUBE_TRANSCRIPT_CACHE.get(cacheKey);
			if (cachedData) {
				return corsResponse(cachedData, {
					headers: {
						"X-Cache-Status": "HIT",
						"Cache-Control": "public, max-age=31536000, immutable",
					},
				});
			}
		} catch (error) {
			console.error(`Cache read error for ${videoId}:`, error);
		}

		// Fetch transcript and title
		try {
			const [transcript, title] = await Promise.all([
				YoutubeTranscript.fetchTranscript(videoId, { lang }),
				getVideoTitle(videoId),
			]);

			// Clean up transcript text
			const cleanedTranscript = transcript.map(item => ({
				...item,
				text: item.text.replace(/&amp;/g, '&').replace(/&#39;/g, "'")
			}));

			const response: YoutubeWorkerResponse = {
				videoId,
				title,
				transcript: cleanedTranscript,
			};

			const responseJson = JSON.stringify(response);

			// Cache the result (24 hours)
			ctx.waitUntil(env.YOUTUBE_TRANSCRIPT_CACHE.put(cacheKey, responseJson, {
				expirationTtl: 86400
			}));

			return corsResponse(responseJson, {
				headers: {
					"X-Cache-Status": "MISS",
					"Cache-Control": "public, max-age=31536000, immutable",
				},
			});

		} catch (error) {
			console.error(`Error processing transcript for ${videoId}:`, error);

			const errorResponse: YoutubeWorkerResponse = {
				videoId,
				transcript: [],
				error: error instanceof Error ? error.message : "Unknown error occurred",
			};

			return corsResponse(JSON.stringify(errorResponse), { status: 500 });
		}
	},
};