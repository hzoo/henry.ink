/**
 * Local Bun server for Arena channel link enhancement
 * Provides HTTP API endpoints for content enhancement
 */

import { ChannelStorage } from './channel-storage';
import { ChannelPatternMatcher } from './pattern-matcher';
import { LinkEnhancer, type EnhancementOptions } from './link-enhancer';
import type { ArenaChannel } from './arena-client';


// Environment configuration
const PORT = parseInt(process.env.ARENA_PORT || '3001');
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_PATH = process.env.ARENA_DB_PATH || './henry-ink/arena/data/channels.db';
const CORS_ORIGINS = process.env.ARENA_CORS_ORIGINS?.split(',') || ['https://henry.ink'];

console.log('🔍 Environment:', {
  PORT,
  NODE_ENV,
  DB_PATH,
  CORS_ORIGINS
});

// Initialize components with environment-aware database path
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



const server = Bun.serve({
  port: PORT,
  
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    
    // CORS configuration based on environment
    const origin = req.headers.get('Origin') || '';
    const allowedOrigin = CORS_ORIGINS.includes('*') || CORS_ORIGINS.includes(origin) ? origin || '*' : 'null';
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      switch (path) {
        case '/enhance':
          return await handleEnhance(req, corsHeaders);
        
        case '/api/search-arena':
          return await handleArenaSearch(req, corsHeaders);
        
        case '/channel-blocks':
          return await handleChannelBlocks(req, corsHeaders);
        
        case '/health':
          return new Response('OK', {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
          });
        
        default:
          return new Response('Not Found', {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
          });
      }
    } catch (error) {
      console.error('Server error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
});

/**
 * Handle Arena channel blocks requests
 */
async function handleChannelBlocks(req: Request, corsHeaders: Record<string, string>): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  try {
    const body = await req.json() as { slug: string };
    const { slug } = body;
    
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
    
    const channelWithBlocks = await arenaClient.fetchChannelBlocks(slug);
    
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
        const appToken = process.env.VITE_ARENA_APP_TOKEN;
        const authToken = process.env.VITE_ARENA_AUTH_TOKEN;
        
        const headers: Record<string, string> = {
          'Accept': 'application/json',
        };
        
        if (appToken) headers['x-app-token'] = appToken;
        if (authToken) headers['x-auth-token'] = authToken;

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

/**
 * Handle Arena search requests
 */
async function handleArenaSearch(req: Request, corsHeaders: Record<string, string>): Promise<Response> {
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
      // Filter out empty channels (no content blocks)
      const filteredChannels = channels.filter(ch => ch.length && ch.length > 0);
      
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
      console.log(`📦 Saved ${normalizedChannels.length} channels to database (filtered ${channels.length - filteredChannels.length} empty channels)`);
      
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
 * Handle content enhancement requests
 */
async function handleEnhance(req: Request, corsHeaders: Record<string, string>): Promise<Response> {
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

console.log(`🚀 Arena enhancement server running on http://localhost:${PORT}`);
console.log(`📁 Database: ${DB_PATH}`);
console.log(`🌍 Environment: ${NODE_ENV}`);
console.log(`🔒 CORS Origins: ${CORS_ORIGINS.join(', ')}`);
console.log('\nAvailable endpoints:');
console.log('  POST /enhance           - Enhance content with Arena channel links');
console.log('  POST /api/search-arena  - Search Arena channels and save to database');
console.log('  POST /channel-blocks    - Fetch blocks for a specific Arena channel');
console.log('  GET  /health            - Health check');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Arena enhancement server...');
  storage.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down Arena enhancement server...');
  storage.close();
  process.exit(0);
});

export { server };