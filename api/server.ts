import { serve } from "bun";
import {
  createArchiveRoute,
  assetProxyRoute,
} from "./archive/routes";
import {
  enhanceRoute,
  arenaSearchRoute,
  channelBlocksRoute,
} from "./arena/routes";
import {
  getTrailsRoute,
  getTrailRoute,
  getStatsRoute,
  getTrailsByActorRoute,
  getTrailsContainingRoute,
  searchTrailsRoute,
  closeTrailStorage
} from "./trails/routes";
import { TrailsIngester } from "./trails/ingester";
import { TrailStorage } from "./trails/trail-storage";
import { youtubeTranscriptRoute } from "./youtube/routes";
import { getCorsHeaders, optionsResponse } from "./cors";

/**
 * Unified API server combining Arena, Archive, and Trails services
 * Production API server on port 3000
 */
const PORT = parseInt(process.env.API_PORT || '3000');

// Initialize trails ingester
const trailStorage = new TrailStorage(process.env.TRAILS_DB_PATH || './api/trails/data/trails.db');
const trailsIngester = new TrailsIngester(trailStorage);

const server = serve({
  hostname: "127.0.0.1",
  port: PORT,
  
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const origin = req.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin);

    // Handle preflight requests globally
    if (req.method === 'OPTIONS') {
      return optionsResponse(req);
    }

    try {
      // Archive service routes
      if (path === '/api/archive') {
        if (req.method === 'GET') {
          return createArchiveRoute(req);
        }
      } else if (path === '/api/asset-proxy') {
        if (req.method === 'GET') {
          return assetProxyRoute(req);
        }
      }

      // YouTube transcript route
      else if (path === '/api/youtube/transcript') {
        if (req.method === 'GET') {
          return youtubeTranscriptRoute(req);
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
      
      // Trails service routes
      else if (path === '/api/trails') {
        if (req.method === 'GET') {
          return getTrailsRoute(req);
        }
      } else if (path === '/api/trails/containing') {
        if (req.method === 'GET') {
          return getTrailsContainingRoute(req);
        }
      } else if (path === '/api/trails/search') {
        if (req.method === 'GET') {
          return searchTrailsRoute(req);
        }
      } else if (path.startsWith('/api/trails/by-actor/')) {
        const actorDid = decodeURIComponent(path.replace('/api/trails/by-actor/', ''));
        if (req.method === 'GET') {
          return getTrailsByActorRoute(req, actorDid);
        }
      } else if (path.startsWith('/api/trails/')) {
        const trailUri = decodeURIComponent(path.replace('/api/trails/', ''));
        if (req.method === 'GET') {
          return getTrailRoute(req, trailUri);
        }
      } else if (path === '/api/stats') {
        if (req.method === 'GET') {
          return getStatsRoute(req);
        }
      }
      
      // Health check for unified API
      else if (path === '/api/health') {
        return new Response(
          JSON.stringify({ 
            status: 'healthy',
            services: ['archive', 'arena', 'trails'],
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
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
});

console.log(`🚀 Unified API server running on http://localhost:${PORT}`);

// Start the trails ingester
trailsIngester.start().catch((error) => {
  console.error("Failed to start trails ingester:", error);
});
console.log('\n📦 Available services:');
console.log('  Archive Service:');
console.log('    GET  /api/archive          - Create secure archive of a web page');
console.log('    GET  /api/asset-proxy      - Proxy assets (fonts, images) with security validation');
console.log('  YouTube Service:');
console.log('    GET  /api/youtube/transcript - Fetch transcripts via server-side YouTube retrieval');
console.log('  Arena Service:');
console.log('    POST /api/arena/enhance    - Enhance content with Arena channel links');
console.log('    POST /api/arena/search     - Search Arena channels');
console.log('    POST /api/arena/channel-blocks - Fetch blocks for a channel');
console.log('  Trails Service (Read-Only AppView):');
console.log('    GET  /api/trails           - List trails (supports ?author_did, ?search, ?limit, ?offset)');
console.log('    GET  /api/trails/:uri      - Get specific trail with marks (?limit=5 for previews)');
console.log('    GET  /api/trails/by-actor/:did - Get trails by specific actor');
console.log('    GET  /api/trails/containing - Find trails containing a URI (?subject=uri)');
console.log('    GET  /api/trails/search    - Search trails (?q=query)');
console.log('    GET  /api/stats            - Get trails system statistics');
console.log('    Note: Create trails/marks via AT Protocol RPC (firehose ingests automatically)');
console.log('  General:');
console.log('    GET  /api/health           - Unified API health check');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down unified API server...');
  trailsIngester.stop();
  closeTrailStorage();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down unified API server...');
  trailsIngester.stop();
  closeTrailStorage();
  process.exit(0);
});

export { server };
