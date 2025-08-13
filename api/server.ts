import { serve } from "bun";
import { 
  createArchiveRoute, 
  assetProxyRoute, 
  archiveOptionsRoute 
} from "./archive/routes";
import { 
  enhanceRoute, 
  arenaSearchRoute, 
  channelBlocksRoute,
  arenaOptionsRoute,
} from "./arena/routes";

/**
 * Unified API server combining Arena and Archive services
 * Production API server on port 3000
 */
const PORT = parseInt(process.env.API_PORT || '3000');

const server = serve({
  port: PORT,
  
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    
    // CORS headers for all API responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight requests globally
    if (req.method === 'OPTIONS') {
      // Route-specific OPTIONS handlers
      if (path === '/api/archive') {
        return archiveOptionsRoute(req);
      } else if (path.startsWith('/api/arena')) {
        return arenaOptionsRoute(req);
      }
      
      // Generic OPTIONS response
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // Archive service routes
      if (path === '/api/archive') {
        if (req.method === 'POST') {
          return createArchiveRoute(req);
        }
      } else if (path === '/api/asset-proxy') {
        if (req.method === 'GET') {
          return assetProxyRoute(req);
        }
      }
      
      // Arena service routes  
      else if (path === '/api/arena/enhance') {
        if (req.method === 'POST') {
          return enhanceRoute(req);
        }
      } else if (path === '/api/arena/search') {
        if (req.method === 'POST') {
          return arenaSearchRoute(req);
        }
      } else if (path === '/api/arena/channel-blocks') {
        if (req.method === 'POST') {
          return channelBlocksRoute(req);
        }
      }
      
      // Health check for unified API
      else if (path === '/api/health') {
        return new Response(
          JSON.stringify({ 
            status: 'healthy',
            services: ['archive', 'arena'],
            port: PORT
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      // 404 for unknown routes
      return new Response('Not Found', {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
      
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

console.log(`🚀 Unified API server running on http://localhost:${PORT}`);
console.log('\n📦 Available services:');
console.log('  Archive Service:');
console.log('    POST /api/archive          - Create secure archive of a web page');
console.log('    GET  /api/asset-proxy      - Proxy assets (fonts, images) with security validation');
console.log('  Arena Service:');
console.log('    POST /api/arena/enhance    - Enhance content with Arena channel links');
console.log('    POST /api/arena/search     - Search Arena channels');
console.log('    POST /api/arena/channel-blocks - Fetch blocks for a channel');
console.log('  General:');
console.log('    GET  /api/health           - Unified API health check');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down unified API server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down unified API server...');
  process.exit(0);
});

export { server };