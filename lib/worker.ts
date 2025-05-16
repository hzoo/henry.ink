/// <reference types="@cloudflare/workers-types" />

import { Client, CredentialManager } from '@atcute/client';
import type { AtpSessionData } from '@atcute/client';

export interface Env {
  BLUESKY_IDENTIFIER: string;
  BLUESKY_APP_PASSWORD: string;
  BLUESKY_SESSION_KV: KVNamespace;
}

const SESSION_KV_KEY = 'bluesky_bot_session';

const allowedOrigins = [
  'http://127.0.0.1:3003',
  'https://annotation-demo.henryzoo.com',
  'https://annotation-sidebar-demo.pages.dev',
  'chrome-extension://lbbbgodnfjcndohnhdjkomcckekjpjni'
];

function setCorsHeaders(response: Response, origin: string | null): void {
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
}

export default {
  async fetch(
    request: Request,
    env: Env, // Access environment variables and secrets via env
    ctx: ExecutionContext // Used for ctx.waitUntil
  ): Promise<Response> {
    const origin = request.headers.get('Origin');

    if (request.method !== 'GET') {
      const response = new Response('Method Not Allowed', { status: 405 });
      setCorsHeaders(response, origin);
      return response;
    }

    try {
      const url = new URL(request.url).searchParams.get('url');
      if (!url || typeof url !== 'string') {
        const response = new Response('Missing or invalid url query parameter', { status: 400 });
        setCorsHeaders(response, origin);
        return response;
      }

      // Create a cache key based on the search URL
      const cacheKey = new Request(new URL(`/search?url=${encodeURIComponent(url)}`, request.url).toString(), {
        headers: request.headers,
        method: 'GET', // Use GET for cache key regardless of original method
      });

      // Check if the response is already in the cache
      // @ts-ignore Property 'default' does not exist on type 'CacheStorage'.
      const cachedResponse = await caches.default.match(cacheKey);
      if (cachedResponse) {
        console.log('Cache hit:', url);
        // Add CORS headers to the cached response before returning
        const response = new Response(cachedResponse.body, cachedResponse);
        setCorsHeaders(response, origin);
        return response;
      }

      console.log('Cache miss:', url);

      const manager = new CredentialManager({ service: 'https://bsky.social' });

      try {
        const sessionJson = await env.BLUESKY_SESSION_KV.get(SESSION_KV_KEY);
        if (sessionJson) {
          manager.session = JSON.parse(sessionJson) as AtpSessionData;
        }
      } catch (kvError: unknown) {
        console.error('Error loading session from KV:', kvError);
      }

      // Login if no session or session is invalid (manager handles refresh)
      if (!manager.session) {
           console.log("No session loaded, performing login.");
           await manager.login({ identifier: env.BLUESKY_IDENTIFIER, password: env.BLUESKY_APP_PASSWORD });
           console.log("Login successful.");
      } else {
           console.log("Session loaded, attempting API call.");
      }

      const rpc = new Client({ handler: manager });

      const {ok ,data} = await rpc.get('app.bsky.feed.searchPosts', {
          params: {
            q: '*',
            url: url as `https://${string}`,
            sort: 'top',
          }
        }
      );

      if (!ok) {
          console.error('Bluesky API error:', data.error);
          if (data.error?.includes('AuthRequired') || data.error?.includes('AuthInvalid')) {
              console.error('Authentication failed after attempted login/refresh. Clearing session from KV.');
              ctx.waitUntil(
                env.BLUESKY_SESSION_KV.delete(SESSION_KV_KEY)
                  .catch((deleteError: Error) => console.error('Error deleting session from KV:', deleteError))
              );
               const response = new Response('Authentication failed. Check credentials or try again.', { status: 401 });
               setCorsHeaders(response, origin);
               return response;
          }
          const response = new Response(`Bluesky API error: ${data.error || 'Unknown error'}`, { status: 500 });
          setCorsHeaders(response, origin);
          return response;
      }

      if (manager.session) {
        ctx.waitUntil(
          env.BLUESKY_SESSION_KV.put(SESSION_KV_KEY, JSON.stringify(manager.session))
            .catch((saveError: Error) => console.error('Error saving session to KV:', saveError))
        );
      }

      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });

      // Cache the successful response
      // @ts-ignore Property 'default' does not exist on type 'CacheStorage'.
      ctx.waitUntil(caches.default.put(cacheKey, response.clone(), { expirationTtl: 600 }));

      // Add CORS headers to the response before returning
      setCorsHeaders(response, origin);
      return response;

    } catch (error: unknown) {
      console.error('Worker error:', error);
      if (error instanceof Error && (error.message.includes('InvalidIdentifier') || error.message.includes('InvalidPassword') || error.message.includes('Authentication Required'))) {
           const response = new Response('Authentication failed. Check your BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD secrets/environment variables.', { status: 401 });
           setCorsHeaders(response, origin);
           return response;
      }
      const response = new Response('Worker error: Failed to perform search.', { status: 500 });
      setCorsHeaders(response, origin);
      return response;
    }
  },
};