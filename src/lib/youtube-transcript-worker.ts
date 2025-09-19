/// <reference types="@cloudflare/workers-types" />

export interface Env {
	YOUTUBE_TRANSCRIPT_CACHE: KVNamespace;
	YOUTUBE_TRANSCRIPT_API_URL?: string;
}

const DEFAULT_API_URL = "https://api.henry.ink/api/youtube/transcript";

const corsResponse = (body: string, options: ResponseInit = {}) => {
	return new Response(body, {
		...options,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Content-Type": "application/json",
			...options.headers,
		},
	});
};

function cacheHeaders(hit: boolean) {
	return hit
		? { "X-Cache-Status": "HIT", "Cache-Control": "public, max-age=31536000, immutable" }
		: { "X-Cache-Status": "MISS", "Cache-Control": "public, max-age=31536000, immutable" };
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const videoId = url.searchParams.get('videoId');
		const lang = url.searchParams.get('lang') || 'en';

		if (!videoId) {
			return corsResponse(JSON.stringify({ error: "Missing videoId parameter" }), { status: 400 });
		}

		const cacheKey = `youtube-transcript:${videoId}:${lang}`;

		try {
			const cached = await env.YOUTUBE_TRANSCRIPT_CACHE.get(cacheKey);
			if (cached) {
				return corsResponse(cached, {
					headers: cacheHeaders(true),
				});
			}
		} catch (error) {
			console.error(`Cache read error for ${videoId}:`, error);
		}

		const apiUrl = env.YOUTUBE_TRANSCRIPT_API_URL || DEFAULT_API_URL;
		let response: Response;

		try {
			response = await fetch(`${apiUrl}?${new URLSearchParams({ videoId, lang })}`, {
				headers: {
					"Accept": "application/json",
				},
			});
		} catch (error) {
			console.error(`Transcript API fetch error for ${videoId}:`, error);
			return corsResponse(JSON.stringify({
				videoId,
				transcript: [],
				error: 'Failed to reach transcript service',
			}), { status: 502 });
		}

		const bodyText = await response.text();

		if (response.ok) {
			ctx.waitUntil(env.YOUTUBE_TRANSCRIPT_CACHE.put(cacheKey, bodyText, {
				expirationTtl: 86400,
			}));
			return corsResponse(bodyText, {
				headers: cacheHeaders(false),
			});
		}

		return corsResponse(bodyText, { status: response.status });
	},
};
