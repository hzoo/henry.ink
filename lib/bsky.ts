import { atCuteState } from '@/site/lib/oauth';
import { Client, CredentialManager } from '@atcute/client';
import type { At } from '@atcute/client/lexicons';

const manager = new CredentialManager({ service: 'https://public.api.bsky.app' });
const rpc = new Client({ handler: manager });

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
      q: '*',
      url,
      sort: 'top',
    };

    const {ok, data} = await (atCuteState.value?.rpc ?? rpc).get('app.bsky.feed.searchPosts', { params, signal: options?.signal });

    if (!ok) {
      switch (data.error) {
        case 'AuthMissing':
          throw new Error('Bluesky search sometimes requires login due to high load. See:');
        default:
          throw new Error(`Error searching Bluesky posts: ${data.error}`);
      }
    }

    // Apply our own sorting for 'top' mode
    return data.posts.sort((a, b) => {
      const scoreA = getEngagementScore(a);
      const scoreB = getEngagementScore(b);
      return scoreB - scoreA;
    });
  } catch (error: unknown) {
    // Log the full error object for inspection
    console.error('Caught bsky search error:', JSON.stringify(error, null, 2));
    
    // Only rethrow if it's not an abort error
    if (error instanceof Error && error.name !== 'AbortError') {
      // Check for specific AuthMissing error
      if (error.message.includes('AuthMissing') || error.message.includes('Authentication Required') || error.message.includes('403')) {
        console.error('Authentication required:', error);
        // Throw the new, simpler error message
        throw new Error('Bluesky search sometimes requires login due to high load. See:');
      }
      // If it wasn't the AuthMissing error, log and rethrow the original error
      console.error('Error searching Bluesky posts:', error);
      throw error;
    }
  }
}

export async function getPostThread(uri: string, options?: { depth?: number; signal?: AbortSignal }) {
  try {
    const {ok, data} = await (atCuteState.value?.rpc ?? rpc).get('app.bsky.feed.getPostThread', { 
      params: { uri: uri as At.ResourceUri, depth: options?.depth ?? 1 },
      signal: options?.signal,
    });

    if (!ok) {
      throw new Error(`Error fetching thread: ${data.error}`);
    }

    return data.thread;
  } catch (error: unknown) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('Error fetching thread:', error);
      throw error;
    }
  }
} 