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

- Apply the staged removal of the transitional HTTP API backend and old arena
  Caddy route. The owner deleted arena DNS and its absence was verified; other
  services still use HTTP origins. Client-IP normalization and origin HTTPS
  are already applied. See the exact cleanup command below.
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
  The owner applied the boot repair below: `pm2-henry.service` now uses
  `/home/henry/.pm2` instead of `/root/.pm2`. It remains enabled but inactive;
  the live daemon still belongs to an old SSH session scope. Do not restart/kill
  PM2 globally during this reader cleanup; it manages other live apps. Live
  systemd supervision and reboot recovery are not yet verified.

Worker/config rollback exports are stored privately outside the repository at
`~/.config/henry-ink/retirement-2026-10-12T20-42-24.456Z`. They do not include KV
contents or Jina's secret value. Recreating Jina would require supplying its API
key again; code rollback alone cannot restore deleted caches or secrets.

Cloudflare cleanup used existing Wrangler OAuth; the audit token is read-only,
stored with mode 0600 outside the repo, and expires October 19, 2026 at 23:59 EDT.
No VPS service restart, Caddy change, SSL change, or cache-rule mutation was made.
Production frontend, API health, Robin Sloan article capture, Margin notes, and
Bluesky search returned HTTP 200 after retirement.

### Boot-configuration repair applied

The owner successfully applied the reviewed helper on October 12, 2026. Backup:
`/etc/systemd/system/.pm2-henry-backup.rslpIx5Z`. Follow-up SSH verified the loaded
`90-henry-home.conf` drop-in, corrected PIDFile, `NeedDaemonReload=no`, and an
enabled/inactive unit. Public API health remained healthy. Do not rerun the
helper: existing overrides intentionally require manual review.

Selected live/saved PM2 launch metadata and statuses match for `henry-ink-api`,
`bible-api`, `statusphere`, `bible-comic-lab`, and `live-bridge`. The
`bible-comic-memory-watch` process is online but saved as stopped;
`bible-comic-chapter-finish` is stopped and absent from the saved list. Decide
whether these one-off jobs belong at boot before changing the shared saved list.
This comparison did not validate complete launch arguments or secret environment.

This is only the boot-configuration repair. The live PM2 daemon remains outside
systemd supervision. Reconcile saved versus running apps and schedule a shared
maintenance window for adoption or a planned reboot; verify all apps afterward.
Origin HTTPS and client-IP normalization were subsequently applied as below.

### Origin HTTPS and API-only Strict applied

On October 12, the candidate was staged in
`/home/henry/henry-caddy-ops.UJhxomZP`. It adds automatic public ACME HTTPS for
`api.henry.ink`, retains HTTP during the Flexible-to-Strict transition, and
normalizes upstream client IPs for API and its old `arena.henry.ink` alias.
Other sites are unchanged. No global trust setting or Caddy upgrade is required.
Source: `ops/caddy-api.caddy`; installer: `scripts/install-caddy-origin.sh`.

Read-only installer preflight passed on the VPS: checksums, current file/active
configuration agreement, service state and candidate adaptation. Seven isolated
header-forwarding cases passed on installed Caddy 2.6.2. Public health is healthy.
No live Caddy or Cloudflare TLS setting was changed by staging/checking.

The owner applied the staged installer successfully. Retained backup:
`/etc/caddy/.origin-install.vwS464IR`. Historical command (do not rerun: the
reviewed baseline is now intentionally stale):

```sh
ssh -t henry@vps 'sudo bash /home/henry/henry-caddy-ops.UJhxomZP/install-caddy-origin.sh --apply /home/henry/henry-caddy-ops.UJhxomZP'
```

The helper validates as the service user, retains a root-owned backup, reloads
Caddy (not restart), and checks loopback HTTP health with guarded rollback.
It refuses stale baselines; do not bypass that check if another deployment edits
Caddy first. Apply succeeded against the live service; rollback was not needed
and has not been exercised against the live service.

At 23:32 UTC on October 12, direct origin HTTPS returned 200 with normal
certificate verification (`ssl_verify_result=0`, no `-k`). The certificate is
for `api.henry.ink`, issued by Let's Encrypt YE2, expiring January 10, 2027 at
22:30:55 UTC; Caddy manages renewal. Caddy remained active/running with no pending
daemon reload.

Using the owner's logged-in dashboard, created and read back active Configuration
Rule `cca0d2fdf7044b5080372081f1243676`, named `API origin TLS - Full (strict)`.
Its sole setting is SSL Strict and its filter is
`(http.host eq "api.henry.ink")`. There were no existing Configuration or Origin
Rules. Read-only API verification confirmed zone-wide SSL remains `flexible`.
The saved audit token still lacks Configuration Rules access; no permissions or
credentials were expanded.

Post-cutover checks: public health 200, allowed-origin preflight 204, unapproved
origin received no allow-origin header, and Robin Sloan archive 200 with the
expected title/HTML, `Cache-Control: no-store` and CF `BYPASS`. No redirect loop
or certificate error occurred. Public HTTPS cutover is complete; the explicit
HTTP API backend and legacy arena alias remain transitional cleanup work,
requiring a separate guarded Caddy change. No firewall or origin admission
restriction was added, and no unrelated site's TLS mode was changed.

### HTTP and arena cleanup staged

The owner deleted the proxied `arena.henry.ink` A record on October 12. Read-only
Cloudflare API verification returned no arena records and the unchanged API A
record (`152.53.230.217`, proxied). There are no application-code references to
the alias in this repository. Its former record was type A, content
`152.53.230.217`, proxied, TTL Auto; restoring DNS would require recreating it.

The next Caddy bundle is `/home/henry/henry-caddy-cleanup.D6SQauMF`. It removes
only the explicit `http://api.henry.ink` and `http://arena.henry.ink` proxy blocks.
Everything else in the shared Caddyfile is byte-for-byte unchanged. The current
`ops/caddy-api.caddy` now describes this HTTPS-only end state. Port 80 stays open
for ACME HTTP challenges and unrelated sites; API HTTP gets Caddy's automatic
308 HTTPS redirect, never the application response. Unknown HTTP hosts can also
get Caddy's generic redirect, but the retired arena host has no API route.

Preflight passed: baseline/active configuration agreement, checksums, service
state, syntax and verified loopback HTTPS health. Ten isolated Caddy cases
passed, covering client-IP forwarding, path/query-preserving HTTP redirect,
retired alias behavior and an unrelated HTTP site. No public certificates were
requested by the tests. Live route removal is **pending owner sudo**:

```sh
ssh -t henry@vps 'sudo bash /home/henry/henry-caddy-cleanup.D6SQauMF/install-caddy-origin.sh --apply /home/henry/henry-caddy-cleanup.D6SQauMF'
```

This version of the installer requires an already valid HTTPS origin. It keeps
a new backup, validates as Caddy, reloads without restarting, checks verified
HTTPS health, the HTTP redirect and no retired-alias response body, then checks
the active config matches disk. It attempts guarded rollback on failure. After
application, recheck public HTTPS health/article/CORS and public HTTP redirect.
No further Cloudflare TLS change is required.

## Caching

Keep archive responses `no-store`: serving them also renews asset permissions.
Keep annotation discovery `no-store` because moderation/deletion can change it.
Do not add a blanket Cache Everything rule. The origin's public asset/transcript
cache headers do not by themselves make extensionless URLs eligible for the
Cloudflare CDN. Any future edge-cache rules must preserve complete query keys,
handle CORS consistently, and never cache errors or authenticated responses.
