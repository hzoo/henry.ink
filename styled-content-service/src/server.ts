import { serve } from "bun";
import homepage from "../public/index.html";
import { extractContent } from "./processor";

// Simple in-memory store for tracking extracted domains
const extractedDomains = new Map<string, number>(); // domain -> timestamp

// Cleanup old domain entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  const FIFTEEN_MINUTES = 15 * 60 * 1000;
  
  for (const [domain, timestamp] of extractedDomains.entries()) {
    if (now - timestamp > FIFTEEN_MINUTES) {
      extractedDomains.delete(domain);
      
    }
  }
}, 15 * 60 * 1000);

const server = serve({
  development: true,
  port: 3000,
  
  routes: {
    "/": homepage,
    
    "/api/extract": {
      async POST(req) {
        try {
          const { url, config } = await req.json();
          
          // Validate URL format and require HTTPS
          const parsedUrl = new URL(url);
          if (parsedUrl.protocol !== 'https:') {
            return Response.json({ error: "Only HTTPS URLs allowed" }, { status: 403 });
          }
          
          // Track the domain being extracted
          const domain = parsedUrl.hostname.replace(/^www\./, '');
          extractedDomains.set(domain, Date.now());
          
          
          const content = await extractContent(url, config);
          return Response.json(content, {
            headers: {
              'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com; img-src 'self' data: https:; script-src 'self'",
              'X-Content-Type-Options': 'nosniff',
              'X-Frame-Options': 'DENY'
            }
          });
        } catch (error) {
          return Response.json({ error: 'Failed to extract content' }, { status: 500 });
        }
      }
    },

    "/api/font-proxy": {
      async GET(req) {
        try {
          const url = new URL(req.url);
          const fontUrl = url.searchParams.get('url');
          
          if (!fontUrl) {
            return Response.json({ error: "Missing font URL parameter" }, { status: 400 });
          }

          // Validate URL format and require HTTPS
          const parsedUrl = new URL(fontUrl);
          if (parsedUrl.protocol !== 'https:') {
            return Response.json({ error: "Only HTTPS URLs allowed" }, { status: 403 });
          }

          // Validate font URL domain
          const fontDomain = parsedUrl.hostname.replace(/^www\./, '');
          
          // Check if this domain was recently extracted (last 15 minutes)
          const extractTime = extractedDomains.get(fontDomain);
          const FIFTEEN_MINUTES = 15 * 60 * 1000;
          
          // Also allow trusted CDNs
          const trustedCDNs = ['fonts.gstatic.com', 'fonts.googleapis.com', 'use.typekit.net', 'cdn.jsdelivr.net'];
          const isTrustedCDN = trustedCDNs.some(cdn => fontDomain.endsWith(cdn));
          
          if (!isTrustedCDN && (!extractTime || (Date.now() - extractTime) > FIFTEEN_MINUTES)) {
            
            return Response.json({ error: "Font domain not recently extracted" }, { status: 403 });
          }

          

          // Fetch the font file
          const response = await fetch(fontUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'font/woff2,font/woff;q=0.8,*/*;q=0.1',
              'Accept-Encoding': 'gzip, deflate, br',
            },
          });

          if (!response.ok) {
            console.error(`Font fetch failed: ${response.status} ${response.statusText}`);
            return Response.json({ 
              error: `Failed to fetch font: ${response.status} ${response.statusText}` 
            }, { status: response.status });
          }

          // Validate content type
          const contentType = response.headers.get('content-type') || '';
          const isValidFont = contentType.includes('font/') ||
                             fontUrl.includes('.woff') ||
                             fontUrl.includes('.woff2') ||
                             fontUrl.includes('.ttf') ||
                             fontUrl.includes('.otf');
          
          if (!isValidFont) {
            console.error(`Invalid font content type: ${contentType}`);
            return Response.json({ error: "Not a valid font file" }, { status: 400 });
          }

          // Check file size (max 5MB)
          const contentLength = response.headers.get('content-length');
          const maxSize = 5 * 1024 * 1024; // 5MB
          if (contentLength && parseInt(contentLength) > maxSize) {
            return Response.json({ error: "Font file too large" }, { status: 413 });
          }

          // Get the font data
          const fontBuffer = await response.arrayBuffer();

          // Return the font with proper headers
          return new Response(fontBuffer, {
            headers: {
              'Content-Type': contentType || 'font/woff2',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=31536000',
              'X-Content-Type-Options': 'nosniff'
            },
          });

        } catch (error) {
          console.error("Font proxy error:", error);
          return Response.json({ 
            error: "Internal server error while proxying font",
            details: error instanceof Error ? error.message : String(error)
          }, { status: 500 });
        }
      }
    }
  }
});

console.log(`🚀 styled-content-service running on ${server.url}`);