export function getPostId(uri: string) {
  return uri.split('/').pop();
}

export function getPostUrl(handle: string, uri: string): string {
  return `https://bsky.app/profile/${handle}/post/${getPostId(uri)}`;
}

export function getAuthorUrl(handle: string): string {
  return `https://bsky.app/profile/${handle}`;
}
