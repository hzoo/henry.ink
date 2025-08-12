import { ChannelStorage } from './channel-storage';
import { ChannelPatternMatcher } from './pattern-matcher';
import { LinkEnhancer, type EnhancementOptions } from './link-enhancer';
import type { ArenaChannel } from './arena-client';

// Arena API tokens
const APP_TOKEN = process.env.ARENA_APP_TOKEN;
const AUTH_TOKEN = process.env.ARENA_AUTH_TOKEN;

// Shared instances for arena functionality
const DB_PATH = process.env.ARENA_DB_PATH || './api/arena/data/channels.db';
const storage = new ChannelStorage(DB_PATH);
const matcher = new ChannelPatternMatcher();
const enhancer = new LinkEnhancer(storage, matcher);

// LRU cache with proper eviction
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

const enhancementCache = new LRUCache<string, unknown>(50);

interface EnhanceRequest {
  content: string;
  url?: string;
  options?: EnhancementOptions;
}

interface ArenaAPIResponse {
  id: number;
  slug: string;
  title: string;
  updated_at: string;
  created_at: string;
  length?: number;
  status?: string;
  user?: { 
    slug: string;
    username?: string;
    full_name?: string;
  };
  owner_slug?: string;
}

// Helper function to get CORS headers
function getCorsHeaders(origin: string = ''): Record<string, string> {
  const CORS_ORIGINS = ['https://henry.ink', 'http://127.0.0.1:3003', 'http://localhost:3003'];
  const allowedOrigin = CORS_ORIGINS.includes(origin) ? origin : '*';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function arenaOptionsRoute(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Handle content enhancement requests
 */
export async function enhanceRoute(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const corsHeaders = getCorsHeaders(origin);

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  try {
    const body: EnhanceRequest = await req.json();
    
    if (!body.content) {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check cache first if URL is provided
    if (body.url) {
      const cacheKey = `${body.url}:${JSON.stringify(body.options || {})}`;
      const cachedResult = enhancementCache.get(cacheKey);
      if (cachedResult) {
        return new Response(
          JSON.stringify(cachedResult),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Find channel matches
    const result = await enhancer.findChannelMatches(body.content, body.options);

    // Cache result if URL is provided
    if (body.url) {
      const cacheKey = `${body.url}:${JSON.stringify(body.options || {})}`;
      enhancementCache.set(cacheKey, result);
      console.log(`🔍 "${body.url}"`);
    }

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Enhancement error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Enhancement failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Handle Arena search requests
 */
export async function arenaSearchRoute(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const corsHeaders = getCorsHeaders(origin);

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  try {
    const body = await req.json() as { query: string };
    const { query } = body;
    
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'Query must be at least 2 characters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`🔍 search: "${query}"`);

    // Search Arena using V2 API with search endpoint
    const searchUrl = new URL('https://api.are.na/v2/search/channels');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('per', '100');
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    
    if (APP_TOKEN) {
      headers['x-app-token'] = APP_TOKEN;
    }
    
    if (AUTH_TOKEN) {
      headers['x-auth-token'] = AUTH_TOKEN;
    }
    
    const response = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Arena API error: ${response.status}`);
    }
    
    const data = await response.json() as { channels: ArenaAPIResponse[] };
    const channels = data.channels || [];
    
    if (channels.length > 0) {
      // Filter out channels with 1 or fewer blocks
      const filteredChannels = channels.filter(ch => ch.length && ch.length > 1);
      
      // Normalize channels for database storage
      const normalizedChannels: ArenaChannel[] = filteredChannels.map((ch: ArenaAPIResponse) => ({
        id: ch.id,
        slug: ch.slug,
        title: ch.title,
        updated_at: ch.updated_at,
        created_at: ch.created_at,
        counts: {
          contents: ch.length || 0
        },
        author_name: ch.user?.username || ch.user?.full_name || ch.user?.slug || 'unknown',
        author_slug: ch.user?.slug,
        visibility_name: ch.status?.toUpperCase() || 'PUBLIC'
      }));
      
      // Save to database
      await storage.storeChannels(normalizedChannels);
      console.log(`📦 Saved ${normalizedChannels.length} channels to database (filtered ${channels.length - filteredChannels.length} channels with ≤1 block)`);
      
      // Auto-refresh patterns so new channels are immediately available for /enhance
      await enhancer.refreshPatterns();
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        channelCount: channels.length,
        query: query
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Arena search error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Arena search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Handle Arena channel blocks requests
 */
export async function channelBlocksRoute(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const corsHeaders = getCorsHeaders(origin);

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  try {
    const body = await req.json() as { slug: string; per?: number; page?: number };
    const { slug, per = 5, page = 1 } = body;
    
    if (!slug || typeof slug !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Channel slug is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Use the arena client to fetch blocks
    const { ArenaClient } = await import('./arena-client');
    const arenaClient = new ArenaClient();
    
    const channelWithBlocks = await arenaClient.fetchChannelBlocks(slug, per, page);
    
    if (!channelWithBlocks) {
      // Clean up dead channels from database
      storage.removeChannelBySlug(slug);
      
      return new Response(
        JSON.stringify({ error: 'Channel not found or no blocks available' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Lazy update author if it's currently unknown
    try {
      const existingChannel = storage.getChannelBySlug(slug);
      if (existingChannel?.author_slug == null) {
        // Fetch channel info to get author data
        const channelInfoUrl = `https://api.are.na/v2/channels/${slug}`;
        
        const headers: Record<string, string> = {
          'Accept': 'application/json',
        };
        
        if (APP_TOKEN) headers['x-app-token'] = APP_TOKEN;
        if (AUTH_TOKEN) headers['x-auth-token'] = AUTH_TOKEN;

        const channelResponse = await fetch(channelInfoUrl, { headers });
        if (channelResponse.ok) {
          const channelData = await channelResponse.json() as { user: { username?: string; full_name?: string; slug?: string } };
          if (channelData.user) {
            const authorName = channelData.user.username || channelData.user.full_name || 'unknown';
            storage.updateChannelAuthor(slug, authorName, channelData.user.slug);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to update author for channel ${slug}:`, error);
    }

    return new Response(
      JSON.stringify(channelWithBlocks),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Arena channel blocks error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch channel blocks',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

// Clean up function for graceful shutdown
export function closeArenaStorage() {
  storage.close();
}