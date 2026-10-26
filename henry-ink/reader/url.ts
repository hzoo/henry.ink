type ReaderParam = 'post' | 'channel' | 'block';

/** Change reader controls without re-encoding a source page's query string. */
export function withReaderParams(url: string, changes: Partial<Record<ReaderParam, string | null>>): string {
  const hashAt = url.indexOf('#');
  const hash = hashAt < 0 ? '' : url.slice(hashAt);
  const base = hashAt < 0 ? url : url.slice(0, hashAt);
  const queryAt = base.indexOf('?');
  const path = queryAt < 0 ? base : base.slice(0, queryAt);
  const parts = queryAt < 0 ? [] : base.slice(queryAt + 1).split('&');
  const replaced = new Set(Object.keys(changes));
  const query = parts.filter(part => !replaced.has(new URLSearchParams(part).keys().next().value || ''));
  for (const [key, value] of Object.entries(changes)) {
    if (value !== null && value !== undefined) query.push(`${key}=${encodeURIComponent(value)}`);
  }
  return path + (query.length ? `?${query.join('&')}` : '') + hash;
}

/** The flat reader URL convention reserves post, channel and block parameters. */
export function sourceFromReaderPath(path: string): string {
  return path.startsWith('/') ? withReaderParams(path, { post: null, channel: null, block: null }).slice(1) : '';
}

export function discussionShareUrl(source: string, post: string): string {
  return withReaderParams(`https://henry.ink/${source}`, { post });
}
