export function getPostId(uri: string) {
  return uri.split('/').pop();
}

export function getPostUrl(handle: string, uri: string): string {
  return `https://bsky.app/profile/${handle}/post/${getPostId(uri)}`;
}

// at://did:plc:fpruhuo22xkm5o7ttr2ktxdo/app.bsky.feed.post/3lnfmd74g2k2j
// https://bsky.app/did:plc:fpruhuo22xkm5o7ttr2ktxdo/post/3lnfmd74g2k2j
export function getPost(uri: string) {
  // replace at:// with https://bsky.app/profile/
  // replace app.bsky.feed.post with post
  return uri.replace('at://', 'https://bsky.app/profile/').replace('app.bsky.feed.post', 'post');
}

export function getAuthorUrl(handle: string): string {
  return `https://bsky.app/profile/${handle}`;
}
