import { createArchive } from "./processor";
import { isTrustedCDNDomain } from "./trusted-cdns";

// API Response Types (exported for frontend use)
export interface ArchiveResponse {
	html: string;
	css?: string;
	title?: string;
	htmlAttrs?: Record<string, string>;
	bodyAttrs?: Record<string, string>;
}

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    // Parse URL from query params for GET request
    const requestUrl = new URL(req.url);
    const url = requestUrl.searchParams.get('url');
    
    if (!url) {
      return Response.json({ error: "Missing url parameter" }, { 
        status: 400,
        headers: corsHeaders
      });
    }
    
    // Validate URL format
    const parsedUrl = new URL(url);
    
    // Allow both HTTP and HTTPS protocols
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      const requestOrigin = req.headers.get('Origin') || '';
      const corsHeaders = getCorsHeaders(requestOrigin);
      return Response.json({ error: "Only HTTP and HTTPS URLs are allowed" }, { 
        status: 403,
        headers: corsHeaders
      });
    }
    
    // Track the domain being archived
    const domain = parsedUrl.hostname.replace(/^www\./, '');
    extractedDomains.set(domain, Date.now());
    
    // Build asset proxy base URL from request origin
    const origin = req.headers.get('Origin');
    const assetProxyBaseUrl = requestUrl.hostname === 'api.henry.ink' 
      ? 'https://api.henry.ink' 
      : `${requestUrl.protocol}//${requestUrl.host}`;
    
    // Auto-detect link rewrite base URL - only rewrite links if on henry.ink production
    const linkRewriteBaseUrl = origin === 'https://henry.ink' ? 'https://henry.ink' : undefined;
    
    const archive = await createArchive(url, assetProxyBaseUrl, linkRewriteBaseUrl);
    return Response.json(archive, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
        'Cloudflare-CDN-Cache-Control': 'max-age=86400, stale-if-error=604800',
        'Content-Security-Policy': "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self' data: https:; img-src 'self' data: https:; style-src-elem 'self' 'unsafe-inline'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none';",
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

export async function assetProxyRoute(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  const startTime = Date.now();
  
  try {
    const url = new URL(req.url);
    const assetUrl = url.searchParams.get('url');
    
    if (!assetUrl) {
      return Response.json({ error: "Missing asset URL parameter" }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate URL format and require HTTPS
    const parsedUrl = new URL(assetUrl);
    if (parsedUrl.protocol !== 'https:') {
      return Response.json({ error: "Only HTTPS URLs allowed" }, { 
        status: 403,
        headers: corsHeaders
      });
    }

    // Validate asset URL domain
    const assetDomain = parsedUrl.hostname.replace(/^www\./, '');
    
    // Check if this domain was recently extracted (last 15 minutes)
    const extractTime = extractedDomains.get(assetDomain);
    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    
    // Also allow trusted CDNs
    const isTrustedCDN = isTrustedCDNDomain(assetDomain);
    
    if (!isTrustedCDN && (!extractTime || (Date.now() - extractTime) > FIFTEEN_MINUTES)) {
      return Response.json({ error: "Asset domain not recently extracted" }, { 
        status: 403,
        headers: corsHeaders
      });
    }

    // Detect asset type from URL and prepare appropriate headers
    const assetType = detectAssetType(assetUrl);
    const acceptHeader = getAcceptHeaderForAssetType(assetType);

    // Fetch the asset file with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
    
    try {
      const response = await fetch(assetUrl, {
        headers: {
          'User-Agent': 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
          'Accept': acceptHeader,
          'Accept-Encoding': 'gzip, deflate, br',
        },
        signal: controller.signal,
      });
      
      if (!response.ok) {
        console.error(`Asset fetch failed: ${response.status} ${response.statusText}`);
        return Response.json({ 
          error: `Failed to fetch asset: ${response.status} ${response.statusText}` 
        }, { 
          status: response.status,
          headers: corsHeaders
        });
      }

      // Validate content type based on asset type
      const contentType = response.headers.get('content-type') || '';
      if (!isValidAssetType(assetUrl, contentType, assetType)) {
        console.error(`Invalid asset content type: ${contentType} for URL: ${assetUrl}`);
        return Response.json({ error: `Not a valid ${assetType} file` }, { 
          status: 400,
          headers: corsHeaders
        });
      }

      // Check file size based on asset type
      const contentLength = response.headers.get('content-length');
      const maxSize = getMaxSizeForAssetType(assetType);
      if (contentLength && parseInt(contentLength) > maxSize) {
        return Response.json({ error: `${assetType} file too large` }, { 
          status: 413,
          headers: corsHeaders
        });
      }

      // Get the asset data
      const assetBuffer = await response.arrayBuffer();

      // Return the asset with proper headers
      return new Response(assetBuffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType || getDefaultContentType(assetType),
          'Cache-Control': 'public, max-age=31536000',
          'X-Content-Type-Options': 'nosniff'
        },
      });
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`❌ Asset timeout: ${assetUrl} | ${duration}ms`);
        return Response.json({ 
          error: 'Asset fetch timeout - try original URL' 
        }, { 
          status: 408,
          headers: corsHeaders
        });
      }
      
      console.error(`❌ Asset error: ${assetUrl} | ${duration}ms`, fetchError);
      return Response.json({ 
        error: 'Asset fetch failed' 
      }, { 
        status: 500,
        headers: corsHeaders
      });
    }

  } catch (error) {
    console.error("Asset proxy error:", error);
    return Response.json({ 
      error: "Internal server error while proxying asset",
      details: error instanceof Error ? error.message : String(error)
    }, { 
      status: 500,
      headers: corsHeaders
    });
  }
}

// Helper functions for asset type detection and validation
function detectAssetType(url: string): 'font' | 'image' | 'unknown' {
  const urlLower = url.toLowerCase();
  
  // Font detection
  if (urlLower.includes('.woff') || urlLower.includes('.woff2') || 
      urlLower.includes('.ttf') || urlLower.includes('.otf') || 
      urlLower.includes('.eot')) {
    return 'font';
  }
  
  // Image detection
  if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || 
      urlLower.includes('.png') || urlLower.includes('.gif') || 
      urlLower.includes('.webp') || urlLower.includes('.svg') ||
      urlLower.includes('.avif') || urlLower.includes('.bmp')) {
    return 'image';
  }
  
  return 'unknown';
}

function getAcceptHeaderForAssetType(assetType: string): string {
  switch (assetType) {
    case 'font':
      return 'font/woff2,font/woff;q=0.8,*/*;q=0.1';
    case 'image':
      return 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';
    default:
      return '*/*';
  }
}

function isValidAssetType(url: string, contentType: string, assetType: string): boolean {
  const urlLower = url.toLowerCase();
  const contentTypeLower = contentType.toLowerCase();
  
  switch (assetType) {
    case 'font':
      return (contentTypeLower.includes('font/') ||
              urlLower.includes('.woff') || urlLower.includes('.woff2') ||
              urlLower.includes('.ttf') || urlLower.includes('.otf')) &&
              !contentTypeLower.includes('image/');
    
    case 'image':
      return contentTypeLower.includes('image/') ||
             urlLower.includes('.jpg') || urlLower.includes('.jpeg') ||
             urlLower.includes('.png') || urlLower.includes('.gif') ||
             urlLower.includes('.webp') || urlLower.includes('.svg') ||
             urlLower.includes('.avif') || urlLower.includes('.bmp');
    
    default:
      return true; // Allow unknown types through for now
  }
}

function getMaxSizeForAssetType(assetType: string): number {
  switch (assetType) {
    case 'font':
      return 5 * 1024 * 1024; // 5MB for fonts
    case 'image':
      return 10 * 1024 * 1024; // 10MB for images
    default:
      return 5 * 1024 * 1024; // 5MB default
  }
}

function getDefaultContentType(assetType: string): string {
  switch (assetType) {
    case 'font':
      return 'font/woff2';
    case 'image':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}