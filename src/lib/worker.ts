import { Client } from "@atcute/client";
import { PasswordSession, type PasswordSessionData } from "@atcute/password-session";

const cache = caches.default;

export interface Env {
	BLUESKY_IDENTIFIER: string;
	BLUESKY_APP_PASSWORD: string;
	BLUESKY_SESSION_KV: KVNamespace;
}

const SESSION_KV_KEY = "bluesky_bot_session";

const allowedOrigins = [
	"http://127.0.0.1:3003",
	"https://henry.ink",
	"chrome-extension://lbbbgodnfjcndohnhdjkomcckekjpjni",
];

function setCorsHeaders(response: Response, origin: string | null): void {
	if (origin && allowedOrigins.includes(origin)) {
		response.headers.set("Access-Control-Allow-Origin", origin);
	}
	response.headers.set("Access-Control-Allow-Methods", "GET");
	response.headers.set("Access-Control-Allow-Headers", "Content-Type");
}

export default {
	async fetch(
		request: Request,
		env: Env, // Access environment variables and secrets via env
		ctx: ExecutionContext, // Used for ctx.waitUntil
	): Promise<Response> {
		const origin = request.headers.get("Origin");

		if (request.method !== "GET") {
			const response = new Response("Method Not Allowed", { status: 405 });
			setCorsHeaders(response, origin);
			return response;
		}

		try {
			const url = new URL(request.url).searchParams.get("url");
			if (!url || typeof url !== "string") {
				const response = new Response(
					"Missing or invalid url query parameter",
					{ status: 400 },
				);
				setCorsHeaders(response, origin);
				return response;
			}

			// Create a cache key based on the search URL
			const cacheKey = new Request(
				new URL(
					`/search?url=${encodeURIComponent(url)}`,
					request.url,
				).toString(),
				{
					headers: request.headers,
					method: "GET", // Use GET for cache key regardless of original method
				},
			);

			// Check if the response is already in the cache
			const cachedResponse = await cache.match(cacheKey);
			if (cachedResponse) {
				// console.log("Cache hit:", url);
				// Add CORS headers to the cached response before returning
				const response = new Response(cachedResponse.body, cachedResponse);
				setCorsHeaders(response, origin);
				return response;
			}

			console.log("Cache miss:", url);

			// Reuse the session cached in KV; log in again only when it is no longer valid.
			// The session refreshes itself on 401 and reports every change back here.
			let cached: PasswordSessionData | undefined;
			try {
				const sessionJson = await env.BLUESKY_SESSION_KV.get(SESSION_KV_KEY);
				if (sessionJson) cached = JSON.parse(sessionJson) as PasswordSessionData;
			} catch (kvError: unknown) {
				console.error("Error loading session from KV:", kvError);
			}

			const session = await PasswordSession.login(
				{
					service: "https://bsky.social",
					identifier: env.BLUESKY_IDENTIFIER,
					password: env.BLUESKY_APP_PASSWORD,
				},
				{
					session: cached,
					onUpdate(data) {
						ctx.waitUntil(
							env.BLUESKY_SESSION_KV.put(SESSION_KV_KEY, JSON.stringify(data)).catch(
								(saveError: Error) => console.error("Error saving session to KV:", saveError),
							),
						);
					},
					onDelete() {
						ctx.waitUntil(
							env.BLUESKY_SESSION_KV.delete(SESSION_KV_KEY).catch(
								(deleteError: Error) => console.error("Error deleting session from KV:", deleteError),
							),
						);
					},
				},
			);

			const rpc = new Client({ handler: session });
			const { ok, data } = await rpc.get("app.bsky.feed.searchPosts", {
				params: {
					q: "*",
					url: url as `https://${string}`,
					sort: "top",
				},
			});

			if (!ok) {
				console.error("Bluesky API error:", data);
				const dataObj = data as { error?: string }; // Type assertion for error handling
				if (
					dataObj.error?.includes("AuthRequired") ||
					dataObj.error?.includes("AuthInvalid") ||
					dataObj.error?.includes("ExpiredToken")
				) {
					console.error(
						"Authentication failed after refresh. Clearing session from KV.",
					);
					ctx.waitUntil(
						env.BLUESKY_SESSION_KV.delete(SESSION_KV_KEY).catch(
							(deleteError: Error) =>
								console.error("Error deleting session from KV:", deleteError),
						),
					);
					const response = new Response(
						"Authentication failed. Check credentials or try again.",
						{ status: 401 },
					);
					setCorsHeaders(response, origin);
					return response;
				}
				const response = new Response(
					`Bluesky API error: ${dataObj.error || "Unknown error"}`,
					{ status: 500 },
				);
				setCorsHeaders(response, origin);
				return response;
			}

			const response = new Response(JSON.stringify(data), {
				headers: { 
					"Content-Type": "application/json",
					"Cache-Control": "public, max-age=600"
				},
				status: 200,
			});

			// Cache the successful response
			ctx.waitUntil(
				cache.put(cacheKey, response.clone()),
			);

			// Add CORS headers to the response before returning
			setCorsHeaders(response, origin);
			return response;
		} catch (error: unknown) {
			console.error("Worker error:", error);
			if (
				error instanceof Error &&
				(error.message.includes("InvalidIdentifier") ||
					error.message.includes("InvalidPassword") ||
					error.message.includes("Authentication Required"))
			) {
				const response = new Response(
					"Authentication failed. Check your BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD secrets/environment variables.",
					{ status: 401 },
				);
				setCorsHeaders(response, origin);
				return response;
			}
			const response = new Response("Worker error: Failed to perform search.", {
				status: 500,
			});
			setCorsHeaders(response, origin);
			return response;
		}
	},
};
