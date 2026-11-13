export const blueskySearchUrl = 'https://bsky-search.henry.ink';

export function resolveApiBase(value: string | undefined, production: boolean): string {
  const url = new URL(value || 'https://api.henry.ink');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('VITE_API_URL must be an HTTP(S) origin without credentials, path, query, or fragment');
  }
  if (production && (url.protocol !== 'https:' ||
      /^(localhost|.*\.localhost|127\..*|0\.0\.0\.0|\[::1\])$/.test(url.hostname))) {
    throw new Error('Production VITE_API_URL must use HTTPS and cannot point to localhost');
  }
  return url.origin;
}
