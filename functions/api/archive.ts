// Cloudflare Pages Function for henry.ink/api/archive: serves stored pages
// without the API, and asks the API only for pages it has not kept.
// The policy lives in src/lib/stored-pages.ts.
import { servePage, type StoredPagesEnv } from '@/src/lib/stored-pages';

interface Context {
  request: Request;
  env: StoredPagesEnv;
  waitUntil(work: Promise<unknown>): void;
}

export const onRequestGet = (context: Context): Promise<Response> =>
  servePage(context.request, context.env, work => context.waitUntil(work));

export const onRequestOptions = (): Response => new Response(null, {
  status: 204,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  },
});
