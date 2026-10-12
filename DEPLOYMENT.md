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

Run `bun run verify` before release. Push the tested commit, then run
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
- Caddy changes need a private password-authenticated sudo session. The saved
  zone audit token can read DNS, SSL, and cache rules, but cannot edit them.
  Wrangler OAuth remains separate and supplies Pages/Worker deployment access.
- Migrate anonymous Bluesky with dedicated server-side credentials and a single
  session manager that serializes login/refresh. Existing Worker secrets cannot
  be retrieved through the secret-list API; do not expose them via a Worker.
- Remove the obsolete `/api/archive` edge-cache rule after obtaining narrowly
  scoped Cache Rules Edit access or using the dashboard. Preserve the separate
  `/api/trains` rule, which belongs to MTA. Origin archive responses are already
  `no-store`; live requests returned `CF-Cache-Status: BYPASS` during this audit.

## Infrastructure inventory (2026-10-12)

- Keep `henry.ink` on Pages, `api.henry.ink` on the VPS, and
  `bsky-search.henry.ink` on its Worker. The public production bundle currently
  references only the API and Bluesky hosts, not Jina or the YouTube Worker.
- Deleted `jina_worker`, `youtube-transcript-worker`, their custom domains/DNS
  records, and `JINA_CACHE`, `youtube_transcript_cache`, and
  `youtube_transcript_cache_preview` after explicit owner approval. All nine
  Workers and ten Pages projects were checked for live KV references; only the
  retired Workers used these namespaces. Seven-day traffic existed, but no
  invocations were reported after the current frontend deployment. Source,
  Wrangler configs, and all corresponding deploy commands were removed.
  Bluesky's Worker/session KV and every unrelated Worker were preserved.
- `arena.henry.ink` is a second Caddy hostname for port 3000, not a separate
  Are.na server. Current source uses `api.henry.ink`; external consumers of the
  alias remain unknown. Removing the alias would not remove a running process.
- Keep `statusphere.henry.ink` (port 3001) and `api-mta.henry.ink` (port 8080):
  they serve separate applications. Other Pages/Worker domains are also outside
  this reader cleanup. Port 8080 listens publicly; review with the MTA app before
  changing its binding or firewall.
- Caddy is active and enabled. The zone's dashboard shows **Flexible SSL**.
  The API and several other origins use HTTP, so do not switch the whole zone
  to strict TLS before origin readiness and per-host overrides are checked.
- The API is one live PM2 process, with watch disabled and autorestart enabled.
  However, `pm2-henry.service` is enabled but inactive: its `User=henry` conflicts
  with `PM2_HOME=/root/.pm2` and `PIDFile=/root/.pm2/pm2.pid`. The actual daemon
  lives under `/home/henry/.pm2` in an old SSH session scope. Repair the existing
  systemd-to-PM2 boot setup in a shared-service maintenance window rather than
  adding a second supervisor. Do not restart/kill PM2 globally during this
  reader cleanup; it manages other live apps. Reboot recovery is not verified.

Worker/config rollback exports are stored privately outside the repository at
`~/.config/henry-ink/retirement-2026-10-12T20-42-24.456Z`. They do not include KV
contents or Jina's secret value. Recreating Jina would require supplying its API
key again; code rollback alone cannot restore deleted caches or secrets.

Cloudflare cleanup used existing Wrangler OAuth; the audit token is read-only,
stored with mode 0600 outside the repo, and expires October 19, 2026 at 23:59 EDT.
No VPS service restart, Caddy change, SSL change, or cache-rule mutation was made.
Production frontend, API health, Robin Sloan article capture, Margin notes, and
Bluesky search returned HTTP 200 after retirement.

### Apply the boot-configuration repair

The reviewed helper is staged at
`/home/henry/henry-ink-ops.MliTwnnP/repair-pm2-startup.sh`; its SHA-256 matches the
repository copy, and read-only preflight passed on the VPS. The owner must run:

```sh
ssh -t henry@vps 'sudo bash /home/henry/henry-ink-ops.MliTwnnP/repair-pm2-startup.sh --apply'
```

Enter the sudo password in that private terminal, not in chat. The helper backs
up the unit, validates and installs a three-setting drop-in, and reloads systemd
configuration. It does not restart services or alter PM2's saved app list. Stop
if it rejects changed configuration; do not bypass its checks. Its backup path
is printed during application.

This is only the boot-configuration repair. The live PM2 daemon remains outside
systemd supervision. Reconcile saved versus running apps and schedule a shared
maintenance window for adoption or a planned reboot; verify all apps afterward.
Origin HTTPS and client-IP normalization are separate Caddy changes, still pending.

## Caching

Keep archive responses `no-store`: serving them also renews asset permissions.
Keep annotation discovery `no-store` because moderation/deletion can change it.
Do not add a blanket Cache Everything rule. The origin's public asset/transcript
cache headers do not by themselves make extensionless URLs eligible for the
Cloudflare CDN. Any future edge-cache rules must preserve complete query keys,
handle CORS consistently, and never cache errors or authenticated responses.
