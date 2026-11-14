import { serve } from "bun";
import {
  createArchiveRoute,
  assetProxyRoute,
} from "./archive/routes";
import { arenaLookupRoute } from "./arena/routes";
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
          return await createArchiveRoute(req);
        }
      } else if (path === '/api/asset-proxy') {
        if (req.method === 'GET') {
          return await assetProxyRoute(req);
        }
      }

      else if (path === '/api/annotations/margin') {
        if (req.method === 'GET') {
          return await marginAnnotationsRoute(req);
        }
      }

      // YouTube transcript route
      else if (path === '/api/youtube/transcript') {
        if (req.method === 'GET') {
          return await youtubeTranscriptRoute(req);
        }
      }

      else if (path === '/api/arena/lookup') {
        if (req.method === 'GET') return await arenaLookupRoute(req);
      }

      // Health check for unified API
      else if (path === '/api/health') {
        return new Response(
          JSON.stringify({ 
            status: 'healthy',
            services: ['archive', 'arena', 'youtube', 'annotations'],
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
console.log('    GET  /api/arena/lookup     - Find public Are.na saves of a URL');
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
