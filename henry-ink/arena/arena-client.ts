/**
 * Arena.na GraphQL API client
 * Fetches channels with filtering and pagination
 */

export interface ArenaChannel {
  id: number;
  slug: string;
  title: string;
  updated_at: string;
  created_at: string;
  counts: {
    contents: number;
  };
  // user field removed due to GraphQL null issues
  visibility_name: string;
}

export interface FetchChannelsOptions {
  per?: number;
  page?: number;
  minContents?: number;
  maxChannels?: number;
  delayMs?: number;
  startPage?: number;
  onProgress?: (current: number, total?: number) => void;
  onPageSaved?: (page: number, channels: number) => void;
  onPageFetched?: (channels: ArenaChannel[]) => Promise<void>;
}

export interface FetchChannelsResult {
  channels: ArenaChannel[];
  hasMore: boolean;
  totalFetched: number;
}

const ARENA_GRAPHQL_ENDPOINT = 'https://api.are.na/graphql';

const CHANNELS_QUERY = `
  query Channels($per: Int!, $page: Int!, $q: String!) {
    ssearch(
      per: $per,
      page: $page,
      q: $q,
      type: [CHANNEL]
      sort_by: CREATED_AT
      direction: ASC
    ) {
      ... on Channel {
        id
        slug
        title
        updated_at
        created_at
        counts {
          contents
        }
        visibility_name
      }
    }
  }
`;

export class ArenaClient {
  private readonly endpoint: string;

  constructor(endpoint: string = ARENA_GRAPHQL_ENDPOINT) {
    this.endpoint = endpoint;
  }

  async fetchChannels(options: FetchChannelsOptions = {}): Promise<FetchChannelsResult> {
    const {
      per = 100,
      page = 1,
      minContents = 1,
      onProgress
    } = options;

    // Get app token from environment
    const appToken = process.env.VITE_ARENA_APP_TOKEN || process.env.ARENA_APP_TOKEN;
    const authToken = process.env.VITE_ARENA_AUTH_TOKEN;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (appToken) {
      headers['x-app-token'] = appToken;
    }
    
    if (authToken) {
      headers['x-auth-token'] = authToken;
    }

    const requestBody = {
      query: CHANNELS_QUERY,
      variables: { per, page, q: "*" }
    };

    console.log(`🔍 Arena API Request - Page ${page}:`);
    console.log(`   Variables:`, JSON.stringify(requestBody.variables));
    const authHeaders = Object.keys(headers).filter(k => k.startsWith('x-')).map(k => k).join(', ');
    if (authHeaders) {
      console.log(`   Auth: ${authHeaders}`);
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error(`❌ Arena API Error Details:`);
      console.error(`   Status: ${response.status} ${response.statusText}`);
      console.error(`   Headers:`, Object.fromEntries(response.headers.entries()));
      
      // Try to get response body for more details
      try {
        const errorText = await response.text();
        console.error(`   Response body:`, errorText);
      } catch {
        console.error(`   Could not read response body`);
      }
      
      throw new Error(`Arena API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const allChannels = data.data?.ssearch || [];
    
    
    // Filter channels with minimum content count
    const filteredChannels = allChannels.filter((ch: ArenaChannel) => 
      ch.counts.contents >= minContents
    );


    if (onProgress) {
      onProgress(page * per, undefined);
    }

    return {
      channels: filteredChannels,
      hasMore: allChannels.length > 0, // If we got any results, assume there might be more
      totalFetched: page * per
    };
  }

  async fetchAllChannels(options: FetchChannelsOptions = {}): Promise<ArenaChannel[]> {
    const {
      per = 1000,
      minContents = 1,
      maxChannels = Infinity,
      delayMs = 3000,
      startPage = 1,
      onProgress,
      onPageSaved,
      onPageFetched
    } = options;

    const allChannels: ArenaChannel[] = [];
    let page = startPage;
    let consecutiveErrors = 0;

    console.log(`🚀 Fetching Arena channels (${per}/page, ${delayMs}ms delay, from page ${startPage})\n`);

    while (allChannels.length < maxChannels) {
      try {
        const result = await this.fetchChannels({ per, page, minContents, onProgress });

        if (result.channels.length === 0) {
          console.log('✅ No more channels - sync complete');
          break;
        }

        allChannels.push(...result.channels);
        consecutiveErrors = 0;

        const firstDate = result.channels[0]?.created_at.split('T')[0];
        const lastDate = result.channels[result.channels.length - 1]?.created_at.split('T')[0];
        console.log(`✅ Page ${page}: ${result.channels.length} channels (${allChannels.length} total) ${firstDate}-${lastDate}`);

        if (onPageFetched) await onPageFetched(result.channels);
        if (onPageSaved) onPageSaved(page, allChannels.length);
        if (onProgress) onProgress(allChannels.length, undefined);

        if (allChannels.length >= maxChannels) break;

        page++;
        if (result.channels.length > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

      } catch (error) {
        consecutiveErrors++;
        console.error(`❌ Page ${page} failed (${consecutiveErrors} consecutive errors):`, error);
        
        if (consecutiveErrors >= 5) {
          console.error(`💥 Too many errors, stopping at ${allChannels.length} channels`);
          break;
        }

        // Special handling for 500 errors (likely rate limiting)
        const errorMessage = error?.message || '';
        const is500Error = errorMessage.includes('500');
        
        let backoffDelay;
        if (is500Error) {
          // For 500 errors, wait 1 minute to reset rate limit
          backoffDelay = 60000;
          console.log(`🚦 Rate limit hit, waiting 60 seconds to reset...`);
        } else {
          // Normal exponential backoff for other errors
          backoffDelay = Math.min(delayMs * Math.pow(2, consecutiveErrors), 30000);
        }
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    console.log(`\n🎉 Completed: ${allChannels.length} channels`);
    return allChannels;
  }


  /**
   * Fetch single channel by slug for on-demand enrichment
   */
  async fetchChannelBySlug(slug: string): Promise<ArenaChannel | null> {
    const CHANNEL_QUERY = `
      query Channel($slug: String!) {
        channel(slug: $slug) {
          id
          slug
          title
          updated_at
          created_at
          counts {
            contents
          }
          user {
            slug
          }
          visibility_name
        }
      }
    `;

    try {
      // Get app token from environment
      const appToken = process.env.VITE_ARENA_APP_TOKEN || process.env.ARENA_APP_TOKEN;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      if (appToken) {
        headers['x-app-token'] = appToken;
      }

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: CHANNEL_QUERY,
          variables: { slug }
        })
      });

      if (!response.ok) {
        throw new Error(`Arena API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.channel || null;
    } catch (error) {
      console.error(`Error fetching channel ${slug}:`, error);
      return null;
    }
  }
}