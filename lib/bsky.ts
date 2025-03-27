import { AtpAgent } from '@atproto/api';

const agent = new AtpAgent({ service: 'https://public.api.bsky.app' });

export async function searchBskyPosts(url: string) {
  try {
    // Search for posts containing the URL
    const response = await agent.app.bsky.feed.searchPosts({ q: url });
    return response.data.posts;
  } catch (error) {
    console.error('Error searching Bluesky posts:', error);
    throw error;
  }
} 