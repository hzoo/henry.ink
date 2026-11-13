# API

One Bun server (`bun run api`, `127.0.0.1:3000`, `API_PORT` to change) for four services. Request and response shapes are defined in each service's `routes.ts`; this file holds the rules the code can't tell you.

| Service | Endpoints | What it does |
|---|---|---|
| Archive | `GET /api/archive?url=`, `GET /api/asset-proxy?url=` | Captures a page's HTML and CSS without running its JavaScript, sanitizes it, and serves its validated images and fonts. |
| Arena | `POST /api/arena/enhance`, `/search`, `/channel-blocks` | Links text to Are.na channels by pattern matching; searches and stores channels. |
| YouTube | `GET /api/youtube/transcript?videoId=&lang=` | Transcript and title, with a bounded in-memory cache. |
| Margin | `GET /api/annotations/margin?url=&offset=` | Read-only lookup of existing annotations from Margin's anonymous targets endpoint. Not an indexer; writes nothing. |

`GET /api/health` reports all four. Env: `ARENA_APP_TOKEN`, `ARENA_AUTH_TOKEN`, and optional `ARENA_DB_PATH`, `ARCHIVE_CACHE_PATH` (its parent directory must exist and be writable).

## Rules

**Archive**
- Any change to capture, sanitization, or rewriting must bump the `archive-v3` key in `snapshot-cache.ts`.
- Responses stay `no-store`. Each response renews the exact asset permissions for that snapshot, including snapshots restored from disk, so do not enable CDN caching without redesigning asset authorization.
- Asset permissions are process-local: run one API process.
- The asset proxy only serves assets referenced by a recent successful archive. It is not a general URL proxy. Assets are checked by content, size-bounded, and sent with `nosniff` and a sandbox CSP. SVGs are validated with a streaming XML parser, not a DOM. A font with the wrong font MIME type is normalized; HTML and cross-family mismatches are rejected.
- Snapshots are fresh for 15 minutes, then served stale while one background capture refreshes them, with a hard 24-hour expiry. A failed refresh backs off for a minute and does not extend expiry. Corrupt or missing persistence falls back to capture, and loaded values must pass the current result schema.
- Cached reads and captures have separate rate-limit budgets. Two captures run at once, with at most eight distinct URLs pending. An admitted capture finishes within its deadline to populate the shared snapshot even if the reader disconnects; an already-aborted reader cannot enqueue one.
- Downloads share a per-page budget and a stylesheet budget; exceeding either cancels the capture's active and queued downloads.
- The web reader's Text mode is derived in the client from the same snapshot. Switching modes must not refetch or recapture.

**Arena**
- The enhancement cache key is the exact text, the URL, and the channel database revision. Unchanged channel writes skip the matcher rebuild; external SQLite writes invalidate it.
- Matches already carry channel metadata, and block responses carry author enrichment. Don't add a second upstream request for either.

**YouTube**
- Title and captions come from one watch-page download. Caption hosts are fixed and redirects are refused.
- Cache keys use the canonical video ID; the response echoes the caller's input.

**Margin**
- The upstream host is fixed. The target `url` is passed as a query value and never fetched. No credentials are forwarded, redirects are blocked, and responses are not cached.
- Annotation bodies are untrusted text, never renderable markup. Record identity and unsupported selectors are preserved. `page.completeness` is always `unknown`. The presentation contract is in [annotations/README.md](annotations/README.md).
- Identical in-flight lookups share one upstream request. One reader cancelling does not cancel the others; the last one leaving cancels upstream.

Exact limits (sizes, deadlines, concurrency, rate budgets) are constants in the code. Change them there, and keep every fetch bounded.

## Checks

- `ARCHIVE_BROWSER_TESTS=1 bun test api/annotations api/archive api/api.test.ts` covers capture isolation, asset validation, persistence, extraction, and the reader.
- Before a processing change, capture the seven reference sites with `bun scripts/archive-baseline.ts /tmp/henry-archive-baseline`. Afterward run `bun scripts/archive-compare.ts /tmp/henry-archive-baseline`, which compares layout metrics and screenshots at 1440 and 390 pixels. It is a regression check against the previous reader, not a claim of parity with the source site. For other articles, pass a JSON array of `["safe-name", "https://article-url"]` pairs as the baseline script's third argument.
- `bun api/arena/optimization.bench.ts` compares unconditional matcher rebuilds with revision-checked reuse.
