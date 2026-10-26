import { expect, test } from 'bun:test';
import { oauthCallbackParams } from '@/src/lib/oauth-callback';

test('only handles complete OAuth responses at the configured redirect', () => {
  const redirect = 'https://henry.ink/';
  for (const suffix of ['#state=login&code=authorized&iss=https%3A%2F%2Fbsky.social', '?state=login&error=access_denied']) {
    expect(oauthCallbackParams(new URL(redirect + suffix), redirect)?.get('state')).toBe('login');
  }
  for (const url of [
    'https://henry.ink/https://example.com/article?code=article-code&state=article-state',
    'https://henry.ink/https://example.com/article#state=article-state&code=article-code',
    'https://other.example/?state=login&code=authorized',
    'https://henry.ink/?code=article-code',
    'https://henry.ink/#state=section',
    'https://henry.ink/?state=&code=authorized',
  ]) expect(oauthCallbackParams(new URL(url), redirect)).toBeNull();
  const custom = 'https://henry.ink/oauth/callback';
  expect(oauthCallbackParams(new URL(custom + '?state=login&code=authorized'), custom)?.get('code')).toBe('authorized');
  expect(oauthCallbackParams(new URL(redirect + '?state=login&code=authorized'), undefined)).toBeNull();
});
