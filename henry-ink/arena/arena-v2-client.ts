/**
 * Arena V2 REST API client
 * Tests if V2 API can access more channels than GraphQL
 */

export interface V2Channel {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  added_to_at: string;
  published: boolean;
  open: boolean;
  collaboration: boolean;
  collaborator_count: number;
  slug: string;
  length: number;
  kind: string;
  status: string; // "private" | "closed" | "public"
  user_id: number;
  metadata: {
    description: string;
  };
  contents: any;
  share_link: any;
  follower_count: number;
  can_index: boolean;
  owner_type: string;
  owner_id: number;
  owner_slug: string;
  "nsfw?": boolean;
  state: string;
  class: string;
  base_class: string;
  user: {
    id: number;
    slug: string;
    username: string;
    first_name: string;
    last_name: string;
    full_name: string;
    avatar: string;
    avatar_image: {
      thumb: string;
      display: string;
    };
    channel_count: number;
    following_count: number;
    follower_count: number;
    profile_id: number;
    initials: string;
    can_index: boolean;
    metadata: {
      description: string | null;
    };
    is_premium: boolean;
    is_lifetime_premium: boolean;
    is_supporter: boolean;
    is_exceeding_connections_limit: boolean;
    is_confirmed: boolean;
    is_pending_reconfirmation: boolean;
    is_pending_confirmation: boolean;
    badge: string;
    class: string;
    base_class: string;
  };
  group: any;
}

export interface V2ChannelsResponse {
  term: string;
  per: number;
  current_page: number;
  total_pages: number;
  length: number;
  authenticated: boolean;
  channels: V2Channel[];
  blocks: any[];
  users: any[];
}

// Interface compatible with existing GraphQL client
export interface ArenaChannel {
  id: number;
  slug: string;
  title: string;
  updated_at: string;
  created_at: string;
  counts: {
    contents: number;
  };
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
  totalPages?: number;
}

const ARENA_V2_ENDPOINT = 'https://api.are.na/v2/channels';

export class ArenaV2Client {
  private endpoint: string;

  constructor(endpoint: string = ARENA_V2_ENDPOINT) {
    this.endpoint = endpoint;
  }

  /**
   * Normalize V2 channel to match GraphQL interface and database schema
   */
  private normalizeChannel(v2Channel: V2Channel): ArenaChannel & { author_name: string } {
    return {
      id: v2Channel.id,
      slug: v2Channel.slug,
      title: v2Channel.title,
      updated_at: v2Channel.updated_at,
      created_at: v2Channel.created_at,
      counts: {
        contents: v2Channel.length
      },
      visibility_name: v2Channel.status.toUpperCase(), // "public" -> "PUBLIC"
      author_name: v2Channel.user?.slug || 'unknown' // Use user.slug for database
    };
  }

  /**
   * Fetch channels from V2 API with pagination
   */
  async fetchChannels(options: {
    per?: number;
    page?: number;
    minContents?: number;
    onProgress?: (current: number, total?: number) => void;
  } = {}): Promise<FetchChannelsResult> {
    const { per = 100, page = 1, minContents = 1, onProgress } = options;

    // Get tokens from environment
    const appToken = process.env.VITE_ARENA_APP_TOKEN;
    const authToken = process.env.VITE_ARENA_AUTH_TOKEN;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    
    if (appToken) {
      headers['x-app-token'] = appToken;
    }
    
    if (authToken) {
      headers['x-auth-token'] = authToken;
    }

    // Build URL with query parameters
    const url = new URL(this.endpoint);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('per', per.toString());

    console.log(`🔍 Arena V2 API Request - Page ${page}:`);
    console.log(`   URL: ${url.toString()}`);
    const authHeaders = Object.keys(headers).filter(k => k.startsWith('x-')).map(k => k).join(', ');
    if (authHeaders) {
      console.log(`   Auth: ${authHeaders}`);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      console.error(`❌ Arena V2 API Error Details:`);
      console.error(`   Status: ${response.status} ${response.statusText}`);
      console.error(`   Headers:`, Object.fromEntries(response.headers.entries()));
      
      try {
        const errorText = await response.text();
        console.error(`   Response body:`, errorText);
      } catch {
        console.error(`   Could not read response body`);
      }
      
      throw new Error(`Arena V2 API error: ${response.status} ${response.statusText}`);
    }

    const data: V2ChannelsResponse = await response.json();
    
    console.log(`   📥 V2 API returned ${data.channels.length} channels (page ${data.current_page}/${data.total_pages})`);
    
    // Normalize channels to match GraphQL interface
    const normalizedChannels = data.channels.map(ch => this.normalizeChannel(ch));
    
    // Filter by minimum content count
    const filteredChannels = normalizedChannels.filter(ch => 
      ch.counts.contents >= minContents
    );

    // Log filtering
    const filteredOutCount = normalizedChannels.length - filteredChannels.length;
    if (filteredOutCount > 0) {
      console.log(`   🔍 Filtered out ${filteredOutCount}/${normalizedChannels.length} channels (contents < ${minContents})`);
    }

    if (onProgress) {
      onProgress(page * per, data.total_pages * per);
    }

    return {
      channels: filteredChannels,
      hasMore: data.current_page < data.total_pages,
      totalFetched: page * per,
      totalPages: data.total_pages
    };
  }

  /**
   * Fetch all channels with pagination
   */
  async fetchAllChannels(options: FetchChannelsOptions = {}): Promise<ArenaChannel[]> {
    const {
      per = 500,
      minContents = 1,
      maxChannels = Infinity,
      delayMs = 5000,
      startPage = 1,
      onProgress,
      onPageSaved,
      onPageFetched
    } = options;

    const allChannels: ArenaChannel[] = [];
    let page = startPage;
    let consecutiveErrors = 0;
    let totalPages: number | undefined;

    console.log(`🚀 Fetching Arena V2 channels (${per}/page, ${delayMs}ms delay, from page ${startPage})\n`);

    while (allChannels.length < maxChannels) {
      try {
        const result = await this.fetchChannels({ per, page, minContents, onProgress });

        // Set total pages from first response
        if (!totalPages && result.totalPages) {
          totalPages = result.totalPages;
          console.log(`📊 V2 API reports ${totalPages} total pages (estimated ${totalPages * per} channels)`);
        }

        if (result.channels.length === 0) {
          console.log('✅ No more channels - V2 sync complete');
          break;
        }

        allChannels.push(...result.channels);
        consecutiveErrors = 0;

        const firstDate = result.channels[0]?.created_at.split('T')[0];
        const lastDate = result.channels[result.channels.length - 1]?.created_at.split('T')[0];
        console.log(`✅ Page ${page}: ${result.channels.length} channels (${allChannels.length} total) ${firstDate}-${lastDate}`);

        // Call page fetched callback
        if (onPageFetched) {
          await onPageFetched(result.channels);
        }

        // Call page saved callback
        if (onPageSaved) {
          onPageSaved(page, allChannels.length);
        }

        // Check if we've reached the end
        if (!result.hasMore) {
          console.log(`✅ Reached end of V2 API at page ${page}`);
          break;
        }

        page++;

        // Add delay between requests
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

      } catch (error) {
        consecutiveErrors++;
        console.error(`❌ Error fetching page ${page}:`, error);

        if (consecutiveErrors >= 3) {
          console.error('💥 Too many consecutive errors, stopping V2 sync');
          break;
        }

        // Wait longer on error
        await new Promise(resolve => setTimeout(resolve, delayMs * 2));
      }
    }

    console.log(`\n📊 V2 API Final Stats:`);
    console.log(`   Total channels fetched: ${allChannels.length}`);
    console.log(`   Last page reached: ${page - 1}`);
    if (totalPages) {
      console.log(`   Total pages available: ${totalPages}`);
      console.log(`   Coverage: ${((page - 1) / totalPages * 100).toFixed(1)}%`);
    }

    return allChannels;
  }
}