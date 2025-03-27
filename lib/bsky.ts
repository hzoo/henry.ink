import { AtpAgent } from '@atproto/api';
import type { QueryParams } from '@atproto/api/dist/client/types/app/bsky/feed/searchPosts';
import { searchSort, searchAuthor } from './signals';

const agent = new AtpAgent({ service: 'https://public.api.bsky.app' });

export async function searchBskyPosts(url: string) {
  try {
    const params: QueryParams = {
      q: url,
      sort: searchSort.value,
    };

    if (searchAuthor.value) {
      params.author = searchAuthor.value;
    }

    const response = await agent.app.bsky.feed.searchPosts(params);
    return response.data.posts;
  } catch (error) {
    console.error('Error searching Bluesky posts:', error);
    throw error;
  }
} 