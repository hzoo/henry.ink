export interface Env {
	JINA_CACHE: KVNamespace;
	JINA_API_KEY: string;
}

// Helper to create responses with CORS headers
const corsResponse = (body: string, options: ResponseInit = {}) => {
	return new Response(body, {
		...options,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
			...options.headers,
		},
	});
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return corsResponse(null, {
				status: 204,
				headers: { "Access-Control-Max-Age": "86400" },
			});
		}

		// Extract target URL from path
		const url = new URL(request.url);
		const targetUrl = url.pathname.substring(1); // Remove leading '/'

		// Simple validation
		if (!targetUrl) {
			return corsResponse(
				"Welcome! Append a URL to the path (e.g., /https://example.com)",
				{ headers: { "Content-Type": "text/plain" } }
			);
		}

		if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
			return corsResponse("URL must start with http:// or https://", { status: 400 });
		}

		// Validate URL format
		try {
			new URL(targetUrl);
		} catch {
			return corsResponse(`Invalid URL format: ${targetUrl}`, { status: 400 });
		}

		const cacheKey = `jina-cache:${targetUrl}`;

		// Check cache first
		try {
			const cachedData = await env.JINA_CACHE.get(cacheKey);
			if (cachedData) {
				return corsResponse(cachedData, {
					headers: {
						"Content-Type": "text/markdown; charset=UTF-8",
						"X-Cache-Status": "HIT",
						"Cache-Control": "public, max-age=31536000, immutable",
					},
				});
			}
		} catch (error) {
			console.error(`Cache read error for ${targetUrl}:`, error);
		}

		// Fetch from Jina API
		try {
			const jinaResponse = await fetch(`https://r.jina.ai/${targetUrl}`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${env.JINA_API_KEY}`,
					Accept: "application/json",
					"X-Md-Heading-Style": "setext",
				},
			});

			if (!jinaResponse.ok) {
				const errorText = await jinaResponse.text();
				console.error(`Jina API error: ${jinaResponse.status} ${jinaResponse.statusText}`, errorText);
				return corsResponse(
					`Jina API error: ${jinaResponse.status} ${jinaResponse.statusText}`,
					{ status: jinaResponse.status }
				);
			}

			const responseData = await jinaResponse.json();
			
			// Handle both old and new response formats
			const content = responseData.data?.content || responseData.content;
			
			if (typeof content !== "string") {
				console.error("No content field in Jina response:", responseData);
				return corsResponse("No content returned from Jina API", { status: 500 });
			}

			// Cache the result (24 hours)
			ctx.waitUntil(env.JINA_CACHE.put(cacheKey, content, { expirationTtl: 86400 }));

			return corsResponse(content, {
				headers: {
					"Content-Type": "text/markdown; charset=UTF-8",
					"X-Cache-Status": "MISS",
					"Cache-Control": "public, max-age=31536000, immutable",
				},
			});

		} catch (error) {
			console.error(`Error processing ${targetUrl}:`, error);
			return corsResponse(
				`Failed to process URL: ${error instanceof Error ? error.message : "Unknown error"}`,
				{ status: 500 }
			);
		}
	},
};