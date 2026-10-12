# Deployment

## Current split

- Cloudflare Pages project `henry-note-reader` serves `henry.ink` in account
  `4eb8c64e85c6cc2bcb31e3df36da1959`. Production branch: `main`.
- The VPS runs one `henry-ink-api` PM2 process from `/home/henry/apps/henry.ink`,
  listening on loopback port 3000 behind Caddy at `api.henry.ink`.
- Chromium capture, article processing, SQLite snapshots, Are.na, Margin, and
  YouTube run on the VPS. Keep one API process while admission limits and asset
  permissions are process-local.
- Anonymous Bluesky search still uses `bsky_search_posts` at
  `bsky-search.henry.ink`. Signed-in requests go directly through the user's RPC.

## Environment

`.env.example` lists development and server settings; `.env.production.example`
lists the public production settings. Actual env files are ignored by Git.

All article, annotation, Are.na, asset, and YouTube endpoints derive from
`VITE_API_URL`. Production builds reject HTTP or localhost origins. Use
`.env.production` or an explicit deployment environment to override a local
development value. `VITE_WORKER_URL` is temporary until Bluesky is migrated.
OAuth values are generated from client metadata, not hand-maintained env files.

Keep `ARENA_APP_TOKEN` and `ARENA_AUTH_TOKEN` server-only. Never place passwords
or tokens in `VITE_*` variables. The VPS does not need any frontend variables.
The former archive/Arena/Jina/YouTube endpoint aliases and
`VITE_EXTENSION_APP_PASSWORD` are no longer used.

## Deploy and verify

Run root/API typechecks, `ARCHIVE_BROWSER_TESTS=1 bun test api src/lib`, and the
web/demo builds before release. Push the tested commit, then run
`scripts/deploy.sh` on the VPS with Bun and PM2 on PATH. It pulls fast-forward
only, installs the lockfile, restarts the API, and checks loopback health.
Deploy the web build with `bun run deploy:ink` and check the public article,
notes, and YouTube routes. Do not deploy the demo or extension incidentally.

## Pending infrastructure changes

- Establish a trusted client-IP contract between Cloudflare, Caddy, and the API.
  Caddy must accept Cloudflare identity only from verified Cloudflare peers and
  overwrite the identity header sent to the API. Do not merely trust arbitrary
  inbound `CF-Connecting-IP` or the first `X-Forwarded-For` value.
- Configure origin HTTPS before enabling Full (strict). Scope the change to
  `api.henry.ink`: other services in the zone still use HTTP origins.
- These Caddy changes need VPS sudo authorization. The current Wrangler OAuth
  token can deploy Pages/Workers but cannot read/manage zone SSL settings.
- Migrate anonymous Bluesky with dedicated server-side credentials and a single
  session manager that serializes login/refresh. Existing Worker secrets cannot
  be retrieved through the secret-list API; do not expose them via a Worker.
- Jina and YouTube Workers remain deployed for old clients/rollback. The new
  reader no longer calls them. Check usage and extension/demo consumers before
  deleting their domains, Workers, KV namespaces, secrets, and Wrangler files.

## Caching

Keep archive responses `no-store`: serving them also renews asset permissions.
Keep annotation discovery `no-store` because moderation/deletion can change it.
Do not add a blanket Cache Everything rule. The origin's public asset/transcript
cache headers do not by themselves make extensionless URLs eligible for the
Cloudflare CDN. Any future edge-cache rules must preserve complete query keys,
handle CORS consistently, and never cache errors or authenticated responses.
