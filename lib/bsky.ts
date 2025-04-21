import { atCuteState } from '@/site/lib/oauth';
import { XRPC, CredentialManager } from '@atcute/client';
import type { At } from '@atcute/client/lexicons';

const manager = new CredentialManager({ service: 'https://public.api.bsky.app' });
const rpc = new XRPC({ handler: manager });

// Calculate engagement score for a post
function getEngagementScore(post: { likeCount?: number; repostCount?: number; replyCount?: number }) {
  const likes = post.likeCount || 0;
  const reposts = post.repostCount || 0;
  const replies = post.replyCount || 0;
  // You could weight these differently if desired, e.g.:
  // return (likes * 1) + (reposts * 2) + (replies * 1.5);
  return likes + reposts + replies;
}

export async function searchBskyPosts(url: string, options?: { signal?: AbortSignal }) {
  try {
    const params = {
      q: url,
      sort: 'top',
    };

    const response = await (atCuteState.value?.xrpc ?? rpc).get('app.bsky.feed.searchPosts', { params, signal: options?.signal });
    if (response.data.posts) {
      // Apply our own sorting for 'top' mode
      return response.data.posts.sort((a, b) => {
        const scoreA = getEngagementScore(a);
        const scoreB = getEngagementScore(b);
        return scoreB - scoreA;
      });
    }
    
    return response.data.posts;
  } catch (error: unknown) {
    // Only rethrow if it's not an abort error
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('Error searching Bluesky posts:', error);
      throw error;
    }
  }
}

export async function getPostThread(uri: string, options?: { depth?: number; signal?: AbortSignal }) {
  try {
    const response = await (atCuteState.value?.xrpc ?? rpc).get('app.bsky.feed.getPostThread', { 
      params: { uri: uri as At.ResourceUri, depth: options?.depth ?? 1 },
      signal: options?.signal,
    });

    return response.data.thread;
  } catch (error: unknown) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('Error fetching thread:', error);
      throw error;
    }
  }
} 