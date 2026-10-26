/** Reader source queries are not OAuth responses, even when they contain code/state. */
export function oauthCallbackParams(current: URL, redirectUri: string | undefined): URLSearchParams | null {
  if (!redirectUri) return null;
  const redirect = new URL(redirectUri);
  if (current.origin !== redirect.origin || current.pathname !== redirect.pathname) return null;
  for (const value of [current.hash.slice(1), current.search.slice(1)]) {
    const params = new URLSearchParams(value);
    if (params.get('state') && (params.get('code') || params.get('error'))) return params;
  }
  return null;
}
