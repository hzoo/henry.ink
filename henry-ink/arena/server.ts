/**
 * Local Bun server for Arena channel link enhancement
 * Provides HTTP API endpoints for content enhancement
 */

import { ChannelStorage } from './channel-storage';
import { ChannelPatternMatcher } from './pattern-matcher';
import { LinkEnhancer, type EnhancementOptions } from './link-enhancer';
import { enableDevelopmentMode, enableProductionMode, getDebugConfig } from './debug-config';

const PORT = 3001;

// Initialize components
const storage = new ChannelStorage();
const matcher = new ChannelPatternMatcher();
const enhancer = new LinkEnhancer(storage, matcher);

// Cache for URL-based enhancement results
const enhancementCache = new Map<string, unknown>();

interface EnhanceRequest {
  content: string;
  url?: string;
  options?: EnhancementOptions;
}

interface StatsResponse {
  storage: {
    totalChannels: number;
    withContent: number;
    qualityChannels: number;
    lastSync: string | null;
  };
  enhancer: {
    isInitialized: boolean;
    patternCount: number;
    channelCount: number;
    buildTime: number;
  };
  debug: {
    logLevel: string;
    enableNormalizationDebug: boolean;
    enablePatternMatchingDebug: boolean;
    enablePerformanceTracking: boolean;
  };
}

const server = Bun.serve({
  port: PORT,
  
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    
    // Enable CORS for local development
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
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
        
        case '/stats':
          return await handleStats(corsHeaders);
        
        case '/debug/enable':
          enableDevelopmentMode();
          return new Response('Development mode enabled', {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
          });
          
        case '/debug/disable':
          enableProductionMode();
          return new Response('Production mode enabled', {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
          });
        
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

    console.log(`🔍 Arena search request: "${query}"`);

    // Search Arena using V2 API with search endpoint
    const searchUrl = new URL('https://api.are.na/v2/search/channels');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('per', '100');
    
    // Get tokens from environment
    const appToken = process.env.VITE_ARENA_APP_TOKEN || process.env.ARENA_APP_TOKEN;
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
    
    const data = await response.json() as { channels: unknown[] };
    const channels = data.channels || [];
    
    console.log(`✅ Found ${channels.length} channels for "${query}"`);
    
    if (channels.length > 0) {
      // Normalize channels for database storage
      const normalizedChannels = channels.map((ch: any) => ({
        id: ch.id,
        slug: ch.slug,
        title: ch.title,
        updated_at: ch.updated_at,
        created_at: ch.created_at,
        counts: {
          contents: ch.length || 0
        },
        visibility_name: ch.status?.toUpperCase() || 'PUBLIC',
        author_name: ch.user?.slug || ch.owner_slug || 'unknown'
      }));
      
      // Save to database
      await storage.storeChannels(normalizedChannels);
      console.log(`📦 Saved ${channels.length} channels to database`);
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
      if (enhancementCache.has(cacheKey)) {
        return new Response(
          JSON.stringify(enhancementCache.get(cacheKey)),
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

/**
 * Handle stats requests
 */
async function handleStats(corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const storageStats = storage.getStats();
    const enhancerStats = enhancer.getStats();
    const debugConfig = getDebugConfig();
    
    const response: StatsResponse = {
      storage: storageStats,
      enhancer: enhancerStats,
      debug: debugConfig,
    };

    return new Response(
      JSON.stringify(response, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Stats error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Stats failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

console.log(`Arena enhancement server running on http://localhost:${PORT}`);
console.log('Available endpoints:');
console.log('  POST /enhance           - Enhance content with Arena channel links');
console.log('  POST /api/search-arena  - Search Arena channels and save to database');
console.log('  GET  /stats             - Get enhancement statistics');
console.log('  GET  /debug/enable      - Enable verbose debugging');
console.log('  GET  /debug/disable     - Enable production mode');
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