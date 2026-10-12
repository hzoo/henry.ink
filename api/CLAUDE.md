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

`css`, `title`, `htmlAttrs`, and `bodyAttrs` are optional. Responses are not HTTP-cached; every response renews its exact asset permissions, including snapshots restored from disk.

Snapshots are fresh for 15 minutes and can be served stale while one background capture refreshes them, up to a hard 24-hour expiry. Failed refreshes back off for one minute without extending expiry. Memory is bounded to 50 entries / 32 MiB, SQLite to 200 entries / 128 MiB of keys and JSON payloads. SQLite overhead is additional. Capture, sanitization, or rewriting changes must bump the `archive-v3` key in `snapshot-cache.ts`. Corrupt or unavailable persistence falls back to capture, and loaded values must pass the current result schema.

Cached reads have a separate, cheaper rate-limit budget from captures. Capture concurrency remains two, with at most eight pending distinct URLs. HTTP responses remain `no-store`; do not enable CDN caching without redesigning asset authorization.

Each capture permits four concurrent resource downloads. Decoded chunks consume a shared 4 MiB page budget and 2 MiB stylesheet budget before retention; exceeding either cancels active and queued downloads. Already-aborted readers cannot enqueue captures. Once admitted, captures finish within their deadline to populate the shared snapshot, even if a reader disconnects.

The web reader derives Text only from this same snapshot, with lazy Readability extraction and semantic HTML sanitization in the client. Switching modes does not fetch Jina or recapture the page. Original-layout CSS is unchanged by extraction.

#### GET `/api/asset-proxy`
Proxies validated image and font assets referenced by a recent successful archive. This is not an unrestricted URL proxy.

**Query Parameters:**
- `url` - Exact referenced asset URL (required)

Assets are checked by content, bounded in size, and returned with `nosniff` and a sandbox CSP.

SVG validation uses streaming XML parsing with a 1 MiB / 64-level / 10,000-element / 128-attributes-per-element limit, not a DOM. Recognized font MIME mismatches are normalized to the detected font format; HTML and cross-family mismatches remain rejected. Asset permissions are process-local: run one API process unless authorization is redesigned for multiple workers.

### Arena Service

#### POST `/api/arena/enhance`
Enhances content with Arena channel links.

Enhancement cache identity includes exact text, options, URL, and the channel database revision. Unchanged channel writes skip matcher rebuilds; external SQLite writes invalidate them. Matches already contain channel metadata, and block responses supply author enrichment without a second upstream request.

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

Title and captions reuse one watch-page download. Retrieval has a 15-second deadline, bounded decoded bodies (5 MiB watch / 2 MiB captions), fixed caption hosts, and no redirects. Cache keys use canonical video IDs; response IDs retain the caller's input.

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

Identical in-flight lookups share upstream work. At most eight distinct lookups run at once, with a separate 30-request burst / 5-per-second client budget. One reader cancelling does not cancel other subscribers; the last subscriber leaving cancels upstream work.

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
ARCHIVE_CACHE_PATH=./archive-snapshots.db  # Optional; parent directory must exist and be writable
```

## Reader Regression Checks

Run `ARCHIVE_BROWSER_TESTS=1 bun test api/annotations api/archive api/api.test.ts` for capture isolation, asset validation, persistence, extraction, and reader tests.

Before a processing change, run `bun scripts/archive-baseline.ts /tmp/henry-archive-baseline` to capture the seven reference sites. Afterward run `bun scripts/archive-compare.ts /tmp/henry-archive-baseline` to compare the saved inputs at 1440 and 390 pixels. The comparison checks layout metrics and viewport screenshots, masking native video/audio controls because their spinners are nondeterministic. Assets are shared between before/after renders. These are regression checks against the previous reader, not a claim of parity with source-site JavaScript.

For other articles, supply a JSON array of `["safe-name", "https://article-url"]` pairs as the baseline script's third argument. Captures exit nonzero if any site fails. Comparisons wait for fonts and lazy images before measuring layout. Run `bun api/arena/optimization.bench.ts` to compare unconditional matcher rebuilding with revision-checked reuse.
