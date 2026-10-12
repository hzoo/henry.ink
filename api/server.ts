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
import { youtubeTranscriptRoute } from "./youtube/routes";
import { getCorsHeaders, optionsResponse } from "./cors";
import { marginAnnotationsRoute } from "@/api/annotations/routes";
import { closeArchiveBrowser } from "@/api/archive/browser-capture";

/**
 * Unified API server combining Arena, Archive, YouTube, and annotation services
 * Production API server on port 3000
 */
const PORT = parseInt(process.env.API_PORT || '3000');

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

      else if (path === '/api/annotations/margin') {
        if (req.method === 'GET') {
          return marginAnnotationsRoute(req);
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
      
      // Health check for unified API
      else if (path === '/api/health') {
        return new Response(
          JSON.stringify({ 
            status: 'healthy',
            services: ['archive', 'arena', 'youtube', 'annotations'],
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
console.log('  Annotation Service:');
console.log('    GET  /api/annotations/margin - Read existing annotations for a URL');
console.log('  General:');
console.log('    GET  /api/health           - Unified API health check');

// Graceful shutdown
async function shutdown() {
  console.log('\nShutting down unified API server...');
  server.stop(true);
  try { await closeArchiveBrowser(); } finally { process.exit(0); }
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

export { server };
