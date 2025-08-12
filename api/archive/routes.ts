import { createArchive } from "./processor";

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

// Helper function to get CORS headers (consistent with arena routes)
function getCorsHeaders(origin: string = ''): Record<string, string> {
  const CORS_ORIGINS = ['https://henry.ink', 'http://127.0.0.1:3003', 'http://localhost:3003'];
  const allowedOrigin = CORS_ORIGINS.includes(origin) ? origin : '*';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function archiveOptionsRoute(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function createArchiveRoute(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
  try {
    const { url, linkRewriteBaseUrl } = await req.json();
    
    // Validate URL format and require HTTPS
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:') {
      const origin = req.headers.get('Origin') || '';
      const corsHeaders = getCorsHeaders(origin);
      return Response.json({ error: "Only HTTPS URLs allowed" }, { 
        status: 403,
        headers: corsHeaders
      });
    }
    
    // Track the domain being archived
    const domain = parsedUrl.hostname.replace(/^www\./, '');
    extractedDomains.set(domain, Date.now());
    
    // Build font proxy base URL from request origin
    const requestUrl = new URL(req.url);
    const fontProxyBaseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    
    const archive = await createArchive(url, fontProxyBaseUrl, linkRewriteBaseUrl);
    return Response.json(archive, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Security-Policy': "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self' data: https:; img-src 'self' data: https:;",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    });
  } catch (error) {
    console.error("Archive creation error:", error);
    return Response.json({ error: 'Failed to create archive' }, { 
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function fontProxyRoute(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
  try {
    const url = new URL(req.url);
    const fontUrl = url.searchParams.get('url');
    
    if (!fontUrl) {
      return Response.json({ error: "Missing font URL parameter" }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate URL format and require HTTPS
    const parsedUrl = new URL(fontUrl);
    if (parsedUrl.protocol !== 'https:') {
      return Response.json({ error: "Only HTTPS URLs allowed" }, { 
        status: 403,
        headers: corsHeaders
      });
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
      return Response.json({ error: "Font domain not recently extracted" }, { 
        status: 403,
        headers: corsHeaders
      });
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
      }, { 
        status: response.status,
        headers: corsHeaders
      });
    }

    // Validate content type and exclude non-font files
    const contentType = response.headers.get('content-type') || '';
    const isValidFont = (contentType.includes('font/') ||
                       fontUrl.includes('.woff') ||
                       fontUrl.includes('.woff2') ||
                       fontUrl.includes('.ttf') ||
                       fontUrl.includes('.otf')) &&
                       !fontUrl.includes('.svg') &&
                       !fontUrl.includes('.png') &&
                       !fontUrl.includes('.jpg') &&
                       !fontUrl.includes('.jpeg') &&
                       !fontUrl.includes('.gif') &&
                       !contentType.includes('image/');
    
    if (!isValidFont) {
      console.error(`Invalid font content type: ${contentType} for URL: ${fontUrl}`);
      return Response.json({ error: "Not a valid font file" }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    // Check file size (max 5MB)
    const contentLength = response.headers.get('content-length');
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (contentLength && parseInt(contentLength) > maxSize) {
      return Response.json({ error: "Font file too large" }, { 
        status: 413,
        headers: corsHeaders
      });
    }

    // Get the font data
    const fontBuffer = await response.arrayBuffer();

    // Return the font with proper headers
    return new Response(fontBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType || 'font/woff2',
        'Cache-Control': 'public, max-age=31536000',
        'X-Content-Type-Options': 'nosniff'
      },
    });

  } catch (error) {
    console.error("Font proxy error:", error);
    return Response.json({ 
      error: "Internal server error while proxying font",
      details: error instanceof Error ? error.message : String(error)
    }, { 
      status: 500,
      headers: corsHeaders
    });
  }
}