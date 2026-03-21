/**
 * Simple AT Protocol post fetcher for rendering posts in trail marks
 */

import type { AppBskyFeedDefs } from "@atcute/bluesky";

/**
 * Parse AT-URI into components
 */
function parseAtUri(atUri: string) {
  const match = atUri.match(/^at:\/\/([^\/]+)\/([^\/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid AT-URI: ${atUri}`);
  }
  return {
    repo: match[1],
    collection: match[2], 
    rkey: match[3]
  };
}

/**
 * Fetch post data from AT-URI using AT Protocol session
 */
export async function fetchPostFromAtUri(atUri: string, session: any): Promise<AppBskyFeedDefs.PostView | null> {
  try {
    const { repo, collection, rkey } = parseAtUri(atUri);
    
    // For posts, use getPostThread which returns proper view formatting
    if (collection === 'app.bsky.feed.post') {
      const { ok, data } = await session.rpc.get('app.bsky.feed.getPostThread', {
        params: { uri: atUri }
      });

      if (ok && data.thread && data.thread.$type === 'app.bsky.feed.defs#threadViewPost') {
        return data.thread.post;
      }
      return null;
    }

    // For other record types (like future trail marks), use getRecord + profile fetch
    const [recordResult, profileResult] = await Promise.allSettled([
      session.rpc.get('com.atproto.repo.getRecord', {
        params: { repo, collection, rkey }
      }),
      session.rpc.get('app.bsky.actor.getProfile', {
        params: { actor: repo }
      })
    ]);

    if (recordResult.status !== 'fulfilled' || !recordResult.value.ok) {
      return null;
    }

    const recordData = recordResult.value.data;
    
    // Use profile data if available, fallback to basic info
    let authorInfo = {
      did: repo,
      handle: repo.includes(':') ? repo : `${repo}.bsky.social`,
      displayName: undefined,
      avatar: undefined
    };

    if (profileResult.status === 'fulfilled' && profileResult.value.ok) {
      const profile = profileResult.value.data;
      authorInfo = {
        did: profile.did,
        handle: profile.handle,
        displayName: profile.displayName,
        avatar: profile.avatar
      };
    }

    // Convert to PostView format (for non-posts, this is approximate)
    return {
      uri: atUri,
      cid: recordData.cid,
      author: authorInfo,
      record: recordData.value,
      embed: recordData.value.embed,
      indexedAt: recordData.value.createdAt || new Date().toISOString(),
      replyCount: 0,
      repostCount: 0, 
      likeCount: 0,
      quoteCount: 0
    } as AppBskyFeedDefs.PostView;

  } catch (error) {
    console.warn('Failed to fetch post from AT-URI:', atUri, error);
    return null;
  }
}