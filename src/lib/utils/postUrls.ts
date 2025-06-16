export function getPostId(uri: string) {
  return uri.split('/').pop();
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

export function getAtUriFromUrl(url: string): string {
  if (!url.startsWith('at://') && url.includes('bsky.app/profile/')) {
    const match = url.match(/profile\/([\w:.]+)\/post\/([\w]+)/);
    if (match) {
      const [, handleOrDid, postId] = match;
      return `at://${handleOrDid}/app.bsky.feed.post/${postId}`;
    }
  }
  return url;
}
