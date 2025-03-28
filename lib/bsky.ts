import { AtpAgent } from '@atproto/api';
import type { QueryParams } from '@atproto/api/dist/client/types/app/bsky/feed/searchPosts';
import { searchSort, searchAuthor } from './signals';

const agent = new AtpAgent({ service: 'https://public.api.bsky.app' });

// Calculate engagement score for a post
function getEngagementScore(post: { likeCount?: number; repostCount?: number; replyCount?: number }) {
  const likes = post.likeCount || 0;
  const reposts = post.repostCount || 0;
  const replies = post.replyCount || 0;
  // You could weight these differently if desired, e.g.:
  // return (likes * 1) + (reposts * 2) + (replies * 1.5);
  return likes + reposts + replies;
}

export async function searchBskyPosts(url: string, signal?: AbortSignal) {
  try {
    const params: QueryParams = {
      q: url,
      sort: searchSort.value,
    };

    if (searchAuthor.value) {
      params.author = searchAuthor.value;
    }

    const response = await agent.app.bsky.feed.searchPosts(params, { signal });
    
    if (response.data.posts && searchSort.value === 'top') {
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
    const response = await agent.app.bsky.feed.getPostThread(
      { uri, depth: options?.depth ?? 1 },
      { signal: options?.signal }
    );
    if (!response.success) throw new Error("Could not fetch thread");
    return response.data.thread;
  } catch (error: unknown) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('Error fetching thread:', error);
      throw error;
    }
  }
} 