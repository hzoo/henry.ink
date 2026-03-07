/**
 * API routes for trails and marks
 * Provides REST endpoints for the Are.na-like trail system
 */

import { TrailStorage, type StoredTrail, type StoredMark, type StoredTrailView } from './trail-storage';
import type { Profile } from './types';
import { getCorsHeaders, optionsResponse } from '../cors';

// Initialize storage
const DB_PATH = process.env.TRAILS_DB_PATH || './api/trails/data/trails.db';
const storage = new TrailStorage(DB_PATH);

/**
 * Transform StoredTrailView to camelCase TrailView for API responses
 */
function transformTrailView(storedTrail: any): any {
  // Extract handle from DID if available (for display purposes)
  const did = storedTrail.author_did || '';
  let displayHandle = storedTrail.author_handle || '';
  
  // If no handle is stored, create a friendly display from DID
  if (!displayHandle && did) {
    // Extract the last part of the DID as a fallback display
    const didParts = did.split(':');
    displayHandle = didParts[didParts.length - 1].substring(0, 8) + '...';
  }

  return {
    uri: storedTrail.uri,
    cid: storedTrail.cid || '',
    name: storedTrail.name,
    description: storedTrail.description,
    creator: {
      did: did,
      handle: displayHandle,
      displayName: storedTrail.author_display_name || undefined,
      avatar: storedTrail.author_avatar || undefined,
    },
    markCount: storedTrail.mark_count || 0,
    indexedAt: storedTrail.indexed_at,
    createdAt: storedTrail.created_at,
    latestMarkAt: storedTrail.latest_mark_at,
  };
}

export { optionsResponse as trailsOptionsRoute };

/**
 * GET /api/trails - List trails
 * Query params: author_did, search, limit, offset
 */
export async function getTrailsRoute(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin') || '');
  
  try {
    const url = new URL(req.url);
    const authorDid = url.searchParams.get('author_did');
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let trails: StoredTrailView[];

    if (search) {
      trails = storage.searchTrails(search, limit);
    } else if (authorDid) {
      trails = storage.getTrailsByAuthor(authorDid, limit, offset);
    } else {
      trails = storage.getRecentTrails(limit, offset);
    }

    const transformedTrails = trails.map(transformTrailView);

    return new Response(JSON.stringify(transformedTrails), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching trails:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch trails',
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
 * GET /api/trails/:uri - Get specific trail with marks
 */
export async function getTrailRoute(req: Request, uri: string): Promise<Response> {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin') || '');
  
  try {
    const trail = storage.getTrail(uri);
    if (!trail) {
      return new Response(
        JSON.stringify({ error: 'Trail not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    const marks = storage.getTrailMarks(uri, limit, offset);
    
    // Get creator profile information
    const creatorProfile = storage.getProfile(trail.author_did);

    return new Response(JSON.stringify({
      trail: {
        ...trail,
        creator: creatorProfile
      },
      marks
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching trail:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch trail',
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
 * GET /api/stats - Get trail system statistics
 */
export async function getStatsRoute(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin') || '');
  
  try {
    const stats = storage.getStats();
    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch stats',
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
 * GET /api/trails/by-actor - Get trails created by specific actor
 */
export async function getTrailsByActorRoute(req: Request, actorDid: string): Promise<Response> {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin') || '');
  
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const trails = storage.getTrailsByAuthor(actorDid, limit, offset);
    const transformedTrails = trails.map(transformTrailView);

    return new Response(JSON.stringify(transformedTrails), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching trails by actor:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch trails by actor',
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
 * GET /api/trails/containing - Find trails containing a specific URI
 */
export async function getTrailsContainingRoute(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin') || '');
  
  try {
    const url = new URL(req.url);
    const subjectUri = url.searchParams.get('subject');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const authorDid = url.searchParams.get('author_did');

    if (!subjectUri) {
      return new Response(
        JSON.stringify({ error: 'subject parameter is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const trails = storage.getTrailsContaining(subjectUri, limit, authorDid || undefined);
    const transformedTrails = trails.map(transformTrailView);

    return new Response(JSON.stringify(transformedTrails), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching trails containing subject:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch trails containing subject',
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
 * GET /api/trails/search - Search trails by name or description
 */
export async function searchTrailsRoute(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin') || '');
  
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'Query must be at least 2 characters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const trails = storage.searchTrails(query.trim(), limit);
    const transformedTrails = trails.map(transformTrailView);

    return new Response(JSON.stringify(transformedTrails), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error searching trails:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to search trails',
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
 * Clean up function for graceful shutdown
 */
export function closeTrailStorage(): void {
  storage.close();
}