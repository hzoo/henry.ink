// Cloudflare Pages Function for henry.ink/api/archive: serves stored pages
// without the API, and asks the API only for pages it has not kept.
// The policy lives in src/lib/stored-pages.ts.
import { optionsResponse } from '@/api/cors';
import { servePage, type StoredPagesEnv } from '@/src/lib/stored-pages';

interface Context {
  request: Request;
  env: StoredPagesEnv;
  waitUntil(work: Promise<unknown>): void;
}

export const onRequestGet = (context: Context): Promise<Response> =>
  servePage(context.request, context.env, work => context.waitUntil(work));

export const onRequestOptions = (context: Context): Response => optionsResponse(context.request);
