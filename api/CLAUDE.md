# API Services

## Overview
Unified API server providing Arena, Archive, and Trails services through a single endpoint. Contains modular services for content enhancement, web page archiving, and AT Protocol trails/marks aggregation.

## Services

### Archive Service
Creates secure archives of web pages by capturing the full HTML content and validating CSS with Lightning CSS. It strips JavaScript for security while preserving visual styling and fonts.

### Arena Service  
Enhances content with Arena channel links using pattern matching and provides search/discovery capabilities for Arena channels.

### Trails Service
Read-only AppView for ink.henry.annotate.trail and ink.henry.annotate.mark records. Ingests data from AT Protocol firehose and provides fast aggregated queries. Record creation happens via AT Protocol RPC (not through this API).

## Development Commands

```bash
# From project root
bun run api             # Start unified API server (port 3000)
```

## API Endpoints

### Archive Service

#### POST `/api/archive`
Creates a secure archive of a web page.

**Request:**
```json
{
  "url": "https://example.com/article"
}
```

**Response:**
```json
{
  "html": "archived HTML with security processing",
  "css": "processed and validated CSS",
  "title": "Page Title",
  "author": "Author Name", 
  "domain": "example.com",
  "url": "source URL",
  "extractionTime": 1500,
  "contentSize": 45000
}
```

#### GET `/api/font-proxy`
Proxies non-Google fonts with validation.

**Query Parameters:**
- `url` - Font URL to proxy

### Arena Service

#### POST `/api/arena/enhance`
Enhances content with Arena channel links.

**Request:**
```json
{
  "content": "text content to enhance",
  "url": "https://example.com/page",
  "options": { "minWords": 2 }
}
```

#### POST `/api/arena/search`
Searches Arena channels and saves to database.

**Request:**
```json
{
  "query": "search term"
}
```

#### POST `/api/arena/channel-blocks`
Fetches blocks for a specific Arena channel.

**Request:**
```json
{
  "slug": "channel-slug",
  "per": 5,
  "page": 1
}
```

### Trails Service

#### GET `/api/trails`
Lists trails with optional filtering.

**Query Parameters:**
- `author_did` - Filter by author DID
- `search` - Search trail names/descriptions
- `limit` - Results limit (default: 20)
- `offset` - Pagination offset (default: 0)

#### GET `/api/trails/:uri`
Get specific trail with its marks.

**Query Parameters:**
- `limit` - Marks limit (default: 50)
- `offset` - Marks pagination offset (default: 0)

#### GET `/api/trails/by-actor/:did`
Get trails created by specific actor.

#### GET `/api/trails/containing`
Find trails containing a specific URI.

**Query Parameters:**
- `subject` - URI to search for (required)
- `limit` - Results limit (default: 20)

#### GET `/api/trails/search`
Search trails by name or description.

**Query Parameters:**
- `q` - Search query (required, min 2 chars)
- `limit` - Results limit (default: 20)

#### GET `/api/stats`
Get trails system statistics.

**Response:**
```json
{
  "total_trails": 150,
  "total_marks": 1200,
  "total_authors": 45
}
```

### Health Checks

#### GET `/api/health`
Unified API health check.

## Environment Variables

```bash
# Server-side API tokens
ARENA_APP_TOKEN=your_arena_app_token
ARENA_AUTH_TOKEN=your_arena_auth_token

# Database configuration
ARENA_DB_PATH=./api/arena/data/channels.db  # Optional, defaults to this path
TRAILS_DB_PATH=./api/trails/data/trails.db  # Optional, defaults to this path
API_PORT=3000  # Optional, defaults to 3000
```