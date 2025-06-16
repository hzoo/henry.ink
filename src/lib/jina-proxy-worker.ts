export interface Env {
	JINA_CACHE: KVNamespace;
	JINA_API_KEY: string; // Declare the JINA_API_KEY secret
}

export default {
	async fetch(
		request: Request,
		env: Env, // Env now includes JINA_API_KEY
		ctx: ExecutionContext,
	): Promise<Response> {
		// Handle CORS preflight requests
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization",
					"Access-Control-Max-Age": "86400",
				},
			});
		}

		// Helper function to add CORS headers to any response
		const addCorsHeaders = (response: Response): Response => {
			const newResponse = new Response(response.body, response);
			newResponse.headers.set("Access-Control-Allow-Origin", "*");
			newResponse.headers.set(
				"Access-Control-Allow-Methods",
				"GET, POST, PUT, DELETE, OPTIONS",
			);
			newResponse.headers.set(
				"Access-Control-Allow-Headers",
				"Content-Type, Authorization",
			);
			return newResponse;
		};

		const url = new URL(request.url);
		let targetUrlStr = url.pathname.substring(1); // Remove leading '/'

		// Basic validation and attempt to form a full URL if just a domain is provided
		if (
			!targetUrlStr.startsWith("http://") &&
			!targetUrlStr.startsWith("https://")
		) {
			if (targetUrlStr.includes(".")) {
				// Simple check if it might be a domain
				targetUrlStr = `https://${targetUrlStr}`;
			} else {
				// Handle root path or other non-URL paths if necessary
				if (targetUrlStr === "" || targetUrlStr === "index.html") {
					return addCorsHeaders(
						new Response(
							"Welcome! Append a full URL to the path to get its simplified version (e.g., /https://example.com)",
							{ headers: { "Content-Type": "text/plain" } },
						),
					);
				}
				return addCorsHeaders(
					new Response(
						"Invalid path. Please provide a full URL starting with http:// or https:// after the slash.",
						{ status: 400 },
					),
				);
			}
		}

		try {
			new URL(targetUrlStr); // Validate the constructed URL
		} catch (e) {
			return addCorsHeaders(
				new Response(`Invalid target URL: ${targetUrlStr}`, {
					status: 400,
				}),
			);
		}

		const cacheKey = `jina-cache:${targetUrlStr}`;

		// Try to get from cache first
		try {
			const cachedData = await env.JINA_CACHE.get(cacheKey);
			if (cachedData) {
				console.log(`Cache hit for ${targetUrlStr}`);
				return addCorsHeaders(
					new Response(cachedData, {
						headers: {
							"Content-Type": "text/markdown; charset=UTF-8",
							"X-Cache-Status": "HIT",
						},
					}),
				);
			}
		} catch (e: any) {
			console.error(`KV Cache read error for ${targetUrlStr}:`, e.message);
			// Optionally, proceed to fetch from origin even if cache read fails
		}

		console.log(`Cache miss for ${targetUrlStr}, fetching from Jina AI`);

		// IMPORTANT: Store your Jina API key securely, e.g., as a secret in Cloudflare
		// and access it via env.JINA_API_KEY
		const jinaApiKey = env.JINA_API_KEY; // Access the API key from environment variables
		const jinaApiUrl = `https://r.jina.ai/${targetUrlStr}`;

		const jinaRequestOptions = {
			method: "GET",
			headers: {
				Authorization: `Bearer ${jinaApiKey}`,
				Accept: "application/json", // Jina's /r endpoint returns JSON with markdown content
				"X-Md-Heading-Style": "setext",
			},
		};

		try {
			const jinaResponse = await fetch(jinaApiUrl, jinaRequestOptions);

			if (!jinaResponse.ok) {
				const errorText = await jinaResponse.text();
				console.error(
					`Jina API error for ${targetUrlStr}: ${jinaResponse.status} ${jinaResponse.statusText}`,
					errorText,
				);
				return addCorsHeaders(
					new Response(
						`Error fetching from Jina AI: ${jinaResponse.status} ${jinaResponse.statusText}\\\\n\${errorText}`,
						{ status: jinaResponse.status },
					),
				);
			}

			const responseData = (await jinaResponse.json()) as {
				code?: number;
				status?: number;
				data?: {
					title?: string;
					description?: string;
					url?: string;
					content?: string;
					publishedTime?: string;
				};
				content?: string;
			};

			let rawContent: string | undefined;
			let title: string | undefined;
			let description: string | undefined;
			let publishedTime: string | undefined;

			// Handle both new and old response formats
			if (responseData.data) {
				// New format with structured data
				rawContent = responseData.data.content;
				title = responseData.data.title;
				description = responseData.data.description;
				publishedTime = responseData.data.publishedTime;
			} else if (responseData.content) {
				// Old format with direct content
				rawContent = responseData.content;
			}

			if (typeof rawContent !== "string") {
				console.error(
					"Jina API response does not contain expected content field:",
					responseData,
				);
				return addCorsHeaders(
					new Response("Unexpected response format from Jina AI.", {
						status: 500,
					}),
				);
			}

			// Build enhanced markdown content with metadata
			let markdownContent = "";

			if (title) {
				markdownContent += `# ${title}\n\n`;
			}

			if (description) {
				markdownContent += `*${description}*\n\n`;
			}

			if (publishedTime) {
				const date = new Date(publishedTime);
				markdownContent += `**Published:** ${date.toLocaleDateString()}\n\n`;
			}

			markdownContent += rawContent;

			// Cache the markdown content
			// Use expirationTtl for caching duration (e.g., 86400 for 24 hours)
			ctx.waitUntil(
				env.JINA_CACHE.put(cacheKey, markdownContent, { expirationTtl: 86400 }),
			);

			return addCorsHeaders(
				new Response(markdownContent, {
					headers: {
						"Content-Type": "text/markdown; charset=UTF-8",
						"X-Cache-Status": "MISS",
					},
				}),
			);
		} catch (error: unknown) {
			console.error(
				`Error fetching or processing ${targetUrlStr}:`,
				error instanceof Error ? error.message : String(error),
			);
			return addCorsHeaders(
				new Response(
					`Internal server error: ${error instanceof Error ? error.message : String(error)}`,
					{
						status: 500,
					},
				),
			);
		}
	},
};
