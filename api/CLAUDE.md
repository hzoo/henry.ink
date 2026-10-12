# API Services

## Overview
Unified API server providing Archive, Arena, YouTube, and Margin annotation services. The server binds to `127.0.0.1` on port 3000 by default.

## Services

### Archive Service
Captures page HTML and CSS without executing source JavaScript, sanitizes the document, and processes CSS with Lightning CSS. Public destination validation, bounded downloads, and asset validation protect archive retrieval.

### Arena Service  
Enhances content with Arena channel links using pattern matching and provides search/discovery capabilities for Arena channels.

### YouTube Service
Retrieves video transcripts and titles server-side, with a bounded in-memory cache.

### Margin Annotation Service
Reads existing annotations through Margin's anonymous targets endpoint. This is read-only discovery, not a local indexer or record-writing service.

## Development Commands

```bash
# From project root
bun run api             # Start unified API server (port 3000)
```

## API Endpoints

### Archive Service

#### GET `/api/archive`
Creates a secure archive of a web page.

**Query Parameters:**
- `url` - Public HTTP(S) page URL (required)

**Response:**
```json
{
  "html": "archived HTML with security processing",
  "css": "processed and validated CSS",
  "textContent": "page text",
  "title": "Page Title",
  "htmlAttrs": { "lang": "en" },
  "bodyAttrs": { "class": "article" }
}
```

`css`, `title`, `htmlAttrs`, and `bodyAttrs` are optional. Responses are not HTTP-cached; asset permissions are process-local.

#### GET `/api/asset-proxy`
Proxies validated image and font assets referenced by a recent successful archive. This is not an unrestricted URL proxy.

**Query Parameters:**
- `url` - Exact referenced asset URL (required)

Assets are checked by content, bounded in size, and returned with `nosniff` and a sandbox CSP.

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

### YouTube Service

#### GET `/api/youtube/transcript`
Retrieves a transcript and optional video title.

**Query Parameters:**
- `videoId` - YouTube video ID or supported YouTube URL (required)
- `lang` - Transcript language (default: `en`)

**Response:**
```json
{
  "videoId": "video-id",
  "title": "Video Title",
  "transcript": [
    { "text": "Caption text", "offset": 0, "duration": 2.5, "lang": "en" }
  ]
}
```

### Margin Annotation Service

#### GET `/api/annotations/margin`
Reads annotations for a target URL from a fixed Margin upstream. No credentials are forwarded; redirects are blocked, responses are limited to 2 MiB, and an eight-second deadline covers body consumption. Responses are not cached.

**Query Parameters:**
- `url` - HTTP(S) target URL (required; passed as a query value, not fetched directly)
- `offset` - Upstream pagination offset (default: `0`, maximum: `10000`)

The response contains `items`, `skipped`, `via`, `target`, and `page`. Pages advance upstream by 50; `page.completeness` is always `unknown`. Record identity and unsupported selectors are preserved. Bodies remain untrusted text, not renderable markup. See [annotation interoperability](annotations/README.md) for the presentation contract.

### Health Checks

#### GET `/api/health`
Unified API health check.

Reports `status`, `port`, and services `archive`, `arena`, `youtube`, and `annotations`. Global `OPTIONS` handling provides CORS preflight responses.

## Environment Variables

```bash
# Server-side API tokens
ARENA_APP_TOKEN=your_arena_app_token
ARENA_AUTH_TOKEN=your_arena_auth_token

# Database configuration
ARENA_DB_PATH=./api/arena/data/channels.db  # Optional, defaults to this path
API_PORT=3000  # Optional, defaults to 3000
```
