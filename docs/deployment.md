# Deployment and consolidation runbook

Audit date: 2026-10-12. This runbook records the baseline and staged release plan,
not blanket authorization to change production. Subsequent owner-approved legacy
Worker/domain/KV deletion is recorded in [Deployment](../DEPLOYMENT.md).
No application deployment, VPS service restart, or database migration was made
as part of that infrastructure cleanup.

## Start here

1. **Access ready:** the short-lived `henry.ink` read-only audit token is verified; existing Wrangler OAuth supplies deployment access separately. Do not paste tokens into chat. Redirect/Origin/Configuration Rules reads still return 403 with the audit token.
2. **Owner:** use the existing password-authenticated sudo session for reviewed administrator steps. The owner confirmed `(ALL : ALL) ALL`; unattended SSH still cannot authenticate sudo. No new account or passwordless sudo is needed.
3. **Inspect first:** record actual SSL mode, origin overrides, DNS targets, cache rules and rollback targets. Caddy currently serves the API over origin HTTP; public HTTPS does not prove origin TLS.
4. **Administrator + CF owner:** upgrade Caddy, normalize trusted CF client IPs, add/test origin HTTPS, then enable Full (strict) for the approved scope. Preserve unrelated sites and a recovery session.
5. **CF owner:** add an API-host cache-bypass rule after reviewing existing rule precedence. Leave Pages and Worker caches alone.
6. **Release:** verify an immutable candidate, deploy API first and Pages second, then run live acceptance checks. The commands and rollback boundaries are below. No Worker deletion or new CF product is required.

`bun run verify` now isolates test databases in a temporary directory, runs both
type checks, 298 tests including Chrome and PM2 repair checks, builds the web app, and runs six
desktop/mobile production-bundle smoke cases. This passed locally. Deliberate
localhost endpoint, empty article, broken scroll and dropped-CSS mutations were
rejected in an isolated copy. The smoke uses intercepted API responses; live
Cloudflare/VPS/provider acceptance remains separate.

The checked-in GitHub workflow runs this gate but does not configure branch
protection. Make its `verify` job required in the repository ruleset if available.

## Evidence and blockers

Labels: **Verified** means inspected during this audit; **Reported** means supplied
in the task; **Unknown** means not established. Recheck evidence before execution.

| Area | Evidence |
| --- | --- |
| Source revision | **Verified:** local HEAD and VPS checkout were `d88efd24c64d6ea3410ea65b8fc7e8d7291394c6`; VPS working tree was clean. Parent verification changes appeared locally during this audit and were not deployed. |
| Pages | **Verified in source:** `deploy:ink` targets account `4eb8c64e85c6cc2bcb31e3df36da1959`, project `henry-note-reader`, branch `main`, artifact `henry-ink/dist`. Demo deployment targets a different account, `899db3f6d2659dfb20376c7e752c862d`, project `annotation-sidebar-demo`. **Unknown:** live project ownership, production branch, deployment IDs, domain bindings, zone ID/account. |
| VPS | **Verified over read-only SSH:** `henry@vps`, checkout `/home/henry/apps/henry.ink`, Bun `1.3.14`, Caddy `2.6.2`, Google Chrome `139.0.7258.154`. Non-login SSH PATH did not contain Bun/PM2; binaries exist under `/home/henry/.bun/bin`. |
| API | **Verified:** listener `127.0.0.1:3000`; local `/api/health` returned healthy with archive, arena, youtube, annotations. Public HTTPS health returned HTTP 200, `server: cloudflare`, `cf-cache-status: DYNAMIC`. Health does not exercise Chrome, upstream providers, or database contents. |
| Caddy | **Verified:** root-owned `/etc/caddy/Caddyfile` mode 0644 contains `http://api.henry.ink`. A whitelisted GET of the active local Caddy configuration showed the API host on the `:80` server, not the `:443` server; neither server had `trusted_proxies` or `client_ip_headers`. Admin listener is `127.0.0.1:2019`. Caddy also serves unrelated applications. |
| Process manager | **Verified saved PM2 metadata:** `henry-ink-api`, fork mode, cwd `/home/henry/apps/henry.ink`, executable `/usr/bin/bash`, interpreter `none`. **Unknown:** exact live launch arguments, environment overrides, watch mode, restart policy, startup persistence. Saved metadata is not proof of live process configuration. |
| Storage | **Verified files:** `api/arena/data/channels.db` with WAL/SHM; root `archive-snapshots.db`. VPS `.env` contains keys `ARENA_APP_TOKEN`, `ARENA_AUTH_TOKEN`; values were not printed. **Unknown:** effective process overrides of database paths or credentials. |
| Permissions | **Reported:** token named `PagesWorkersKV` works for Pages/Workers/KV but zone SSL query returned 403; sudo unavailable. Not retested. A token name does not prove scopes; 403 does not establish the SSL mode. |
| Verification gate | **Verified in parent's in-progress local files:** `verify` chains root types, API types, browser-enabled tests, `build:ink`, and `tests/reader-smoke.ts`. `deploy:ink` invokes it before upload; `scripts/deploy.sh` invokes it after pull/install and before restart. **Reported by parent at wrap-up:** gate green, 259 tests and 6 production-bundle desktop/mobile smoke cases. **Unknown:** final committed release SHA; this audit did not rerun the gate. |

**Stop conditions:** no production rollout until zone ownership/settings are read,
an authorized VPS administrator is available, origin HTTPS and normalized client
identity are verified, backups and rollback targets exist, and the final candidate
passes `bun run verify`. Public HTTPS currently proves only client-to-edge TLS.
Follow-up dashboard inspection confirmed the zone's default is **Flexible SSL**.
Per-host origin/configuration overrides remain unverified. See the dated
[infrastructure inventory](../DEPLOYMENT.md#infrastructure-inventory-2026-10-12)
for verified domain mappings, Worker traffic, and the PM2 startup mismatch;
that follow-up supersedes the original table's corresponding unknowns.

## Intended boundary

Keep the frontend on Pages and consolidate article capture, text extraction,
asset proxying, Are.na, YouTube transcripts, and Margin reads on the VPS API.
Keep anonymous Bluesky search on its existing Worker for now. This is service
consolidation, not an approved Cloudflare account/zone migration.

| Component | Source contract / action |
| --- | --- |
| Browser | `henry-ink/services.ts`, `henry-ink/reader/archive-cache.ts`, and `src/lib/api-url.ts` use the configured API origin. Both Original and Text use archive data; no Jina call appears in this path. |
| API | `api/server.ts` binds loopback and serves `/api/archive`, `/api/asset-proxy`, `/api/annotations/margin`, `/api/arena/{enhance,search,channel-blocks}`, `/api/youtube/transcript`, `/api/health`. Keep port 3000 private. |
| Bluesky Worker | `wrangler.toml`: script `bsky_search_posts`, binding `BLUESKY_SESSION_KV`, namespace `45e1b4c9deb24ddfbd9fa33d3ad15a3c`. Browser example URL is `https://bsky-search.henry.ink`. Live custom-domain mapping is unknown. |
| Legacy Jina | **Deleted with owner approval:** `jina_worker`, custom domain/DNS, and KV `983b607b41cd406c8a3d78004dd03291`. Source/config/deploy command removed. |
| Legacy YouTube | **Deleted with owner approval:** `youtube-transcript-worker`, custom domain/DNS, KV `e3760955d3c84c9696c52a63352626c8`, and preview KV `fad6ccfee93746f39953411de2082435`. Source/config/deploy command removed. The frontend uses the VPS transcript endpoint. |

Worker configs have no explicit account ID or active route declarations. Do not
bulk-deploy Workers as part of the Pages/API rollout. The blanket
`deploy:workers` script has been removed. Identify their live account,
routes, versions and bindings before any Worker operation; namespace IDs are
account-scoped, not portable migration handles.

### Configuration inventory

| Setting | Where / required value |
| --- | --- |
| `VITE_API_URL` | Public build input: `https://api.henry.ink`. Build validator rejects invalid/non-HTTPS production origins and localhost. |
| `VITE_WORKER_URL` | Public build input: `https://bsky-search.henry.ink`, after verifying that domain's binding. |
| OAuth values | Generated by `scripts/inject-oauth-plugin.ts` from `henry-ink/public/oauth-client-metadata.json`. Validate production client ID and all redirect URIs; do not replace them with preview domains casually. |
| `API_PORT` | VPS-only; default `3000`. Caddy and health probes must match it. |
| `ARENA_DB_PATH` | VPS-only; default `./api/arena/data/channels.db`, resolved against cwd. |
| `ARCHIVE_CACHE_PATH` | VPS-only; default `archive-snapshots.db`, resolved against cwd. |
| `ARENA_APP_TOKEN`, `ARENA_AUTH_TOKEN` | Optional server credentials for upstream access; preserve securely, never `VITE_` inputs. |
| `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD` | Worker runtime credentials; session KV contains sensitive tokens. `SITE_URL` is declared in its interface but unused in inspected implementation. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Deployment runner only. Never upload them in frontend artifacts or install the deployment token in the public API process. |

Vite loads root env files (`envDir: "../"`). Inspect key names without dumping
values; check `.env.local`/mode-specific overrides and the invoking environment.
Direct Upload sends an already-built artifact: dashboard build variables do not
repair a wrongly built bundle. Files ignored by Git are not automatically safe
from an overly broad upload; upload only `henry-ink/dist`.

## Stage 0: approval and access

All actions below that write remote state are **pending explicit approval**.
Approve each change set, operator, maintenance window and rollback target before
execution; approval for this audit did not approve any of them.

| Change set | Minimum authority and scope |
| --- | --- |
| Read-only inventory | Selected account: Pages/Workers/KV read as needed. Only the `henry.ink` zone: Zone Read, DNS Read, Zone Settings Read, Cache Rules Read; add route/rule/Access reads only for resources being inspected. |
| Pages release | Account-scoped **Cloudflare Pages Edit** for the verified Pages account. No DNS/SSL/KV writes. The ordinary token permission is account-wide, not a per-project guarantee; isolate the runner and protect its workflow. |
| Worker change, separately | Selected account: Workers Scripts Edit; Workers KV Storage Edit only if creating/changing KV resources. Add zone Workers Routes Edit or DNS Write only when the approved operation actually changes those resources. |
| SSL mode | Short-lived token with **Zone Settings Write** only for `henry.ink`; separate from routine deployment. Add SSL and Certificates Write only for separate certificate/AOP operations that require it. |
| Cache rules / purge | Zone-only **Cache Settings Write**; separate **Cache Purge** only for approved invalidation. |
| DNS change | Zone-only **DNS Write**, and Zone Read if discovery requires it. No account-wide DNS or global API key. |
| Caddy / TLS / host firewall | Existing authorized administrator or provider console. Administrator reviews and installs root-owned configuration/certificate files and performs the exact validation/reload. Do not give `henry` unrestricted sudo, a writable global Caddyfile, or an unrestricted reload wrapper. |
| Bun / Chrome / OS dependencies | Admin approves any system installation/update. Run API and tests unprivileged; do not solve browser failures by running the application as root. |
| Cloudflare Access, optional | Separate approval and narrowly scoped Access Apps and Policies write for a distinct admin/staging hostname; do not add this to deployment credentials. |

Permission names vary between dashboard Edit labels and API Write labels.
Consult the [permission catalog](https://developers.cloudflare.com/fundamentals/api/reference/permissions/).
The generic zone-setting endpoints specifically document
[Zone Settings Read for GET](https://developers.cloudflare.com/api/resources/zones/subresources/settings/methods/get/)
and [Zone Settings Write for PATCH](https://developers.cloudflare.com/api/resources/zones/subresources/settings/methods/edit/).
Do not assume a Pages token or SSL certificate permission can edit `settings/ssl`.

Use SSH keys, no agent forwarding, a read-only repository deploy key, and the
existing unprivileged application user. Keep secrets in protected runtime storage
with no shell tracing; never print `.env`, `pm2 env`, raw `pm2 jlist`, saved PM2
dumps, authorization headers, private keys or token-bearing curl commands.
Loopback Caddy admin access is powerful, not a substitute for sudo: no mutation
of `localhost:2019` is authorized by read access to it.

The public reader/API must remain anonymous. An Access login wall on either
hostname breaks public reads, CORS and potentially OAuth discovery. CORS is not
authentication. If an admin/staging Access app is approved, select exact users or
groups, no Everyone policy; validate Access tokens at the origin or use a verified
Tunnel path. Never put service-token secrets in `VITE_` variables. See
[self-hosted Access applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/).

## Stage 1: record the baseline

1. Owner records the zone ID and account, Pages project/production branch/current successful deployment ID, Worker account/script/version/domain/bindings, and DNS records including all A/AAAA targets and proxy status. Do not move the zone or recreate resources to fix a token 403.
2. With zone read permission, read `GET /zones/{zone_id}/settings/ssl` and record its value/editability. Inventory Configuration Rules, Origin Rules, redirects, Workers routes, cache/Page Rules, header transforms, Pseudo IPv4, Access apps and WAF/challenges affecting these hosts. Save protected exports and rule IDs/order. No successful read means this stage is incomplete.
3. Administrator compares active Caddy configuration with `/etc/caddy/Caddyfile`, checks service unit/startup path, installed modules, certificate coverage and renewal, firewall/provider ACLs and all unrelated sites. Public port 8080 was observed listening; ownership/external reachability are unknown. Do not close it without identifying its consumer.
4. As `henry`, record live PM2 cwd, script/arguments, interpreter, PATH, selected env key presence, watch/restart settings and startup unit without logging values. Verify it runs this API, in a single process, from the expected cwd. In-memory rate limits and asset admission are not shared across replicas.
5. Capture local and public health/CORS/cache headers and an agreed low-impact live reader baseline. Record results and timestamp separately from this document. Keep a second SSH session and provider console available for infrastructure work.

Safe read-only examples (run on the stated host):

```sh
# Local workstation
git -C /Users/h/dev/henry.ink rev-parse HEAD
git -C /Users/h/dev/henry.ink status --short
ssh -o BatchMode=yes henry@vps \
  'cd /home/henry/apps/henry.ink && git rev-parse HEAD && git status --short'

# VPS as henry
export PATH="/home/henry/.bun/bin:$PATH"
bun --version
caddy version
google-chrome --version
ss -ltn
curl --fail --max-time 5 http://127.0.0.1:3000/api/health
curl --fail --max-time 10 -D - -o /dev/null https://api.henry.ink/api/health
```

## Stage 2: backups and candidate verification

1. Name immutable `APPROVED_SHA` and `PREVIOUS_SHA`, previous Pages production deployment ID, and an operator-owned backup directory outside the checkout. Do not commit or push as an implicit part of deployment. The parent must finish and release its gate first.
2. Administrator securely backs up the entire Caddy configuration, relevant service units, certificate/key material and firewall rules. Restrict backups; do not paste their contents into logs. Record old Caddy package version and an available reinstall artifact before upgrading.
3. Take SQLite-consistent backups of the **effective** Are.na and archive databases using SQLite backup/VACUUM INTO, then integrity-check the copies. Do not copy only a live `.db` while WAL files exist. Retain protected runtime environment and PM2 launch configuration separately. Confirm restore procedure on a disposable copy.
4. Preserve the running checkout and dependencies until the candidate passes. Prepare a detached candidate outside the active checkout, install its frozen lockfile, and run verification with disposable database paths. Do not run `migrate:api`: it recursively deletes the old `henry-ink/arena` directory and is not a safe general migration/backup mechanism.
5. Align Bun/Chrome with the final CI/toolchain contract or explicitly verify the candidate on the VPS versions. Chrome installation alone does not prove launch/library compatibility. The in-progress workflow pinned Bun `1.4.3`, unlike VPS `1.3.14`; reconcile before release. Browser capture uses `channel: "chrome"`, not merely Playwright's bundled Chromium.

Example approved candidate preparation on VPS (writes files but does not deploy;
substitute the reviewed SHA, never a moving branch):

```sh
set -eu
export PATH="/home/henry/.bun/bin:$PATH"
: "${APPROVED_SHA:?set reviewed full commit SHA}"
candidate="/home/henry/apps/henry.ink-candidate-$APPROVED_SHA"
cd /home/henry/apps/henry.ink
git fetch origin
git cat-file -e "$APPROVED_SHA^{commit}"
git worktree add --detach "$candidate" "$APPROVED_SHA"
cd "$candidate"
bun install --frozen-lockfile
testdata=$(mktemp -d)
VITE_API_URL=https://api.henry.ink \
VITE_WORKER_URL=https://bsky-search.henry.ink \
ARENA_DB_PATH="$testdata/channels.db" \
ARCHIVE_CACHE_PATH="$testdata/archive-snapshots.db" \
bun run verify
```

The gate covers root and API types, all relevant tests with
`ARCHIVE_BROWSER_TESTS=1`, real Chrome capture/layout tests, `build:ink`, and the
production-bundle browser smoke. No skips caused by missing Chrome count as a
pass. Retain gate logs and screenshots for the approved SHA. `scripts/verify.sh`
sets temporary Are.na/archive database paths so verification cannot use live data.

`tests/reader-smoke.ts` serves `henry-ink/dist` locally and mocks API/Worker
transport. It checks production **build behavior**, not live TLS, Cloudflare,
upstream credentials, CORS, database health or the deployed revision. Stage 7 is
still required. A unit-test-only run or `/api/health` is not an equivalent gate.

## Stage 3: normalize trusted client identity

**Pending administrator approval.** Upgrade Caddy to a currently supported,
reviewed version with these directives; `trusted_proxies_strict` requires at least
2.8. Do not paste this template into the verified 2.6.2 binary. Validate the full
shared configuration and regression-test unrelated sites before/after upgrade.

`api/archive/routes.ts` and `api/annotations/routes.ts` choose the first XFF
element, then CF-Connecting-IP, then `unknown`. With untrusted Cloudflare peers,
ordinary Caddy defaults can collapse clients onto edge addresses. Blindly
forwarding XFF or blindly trusting CF headers instead enables spoofing. The fix
is a restricted trust boundary plus **one normalized upstream XFF value**.

1. Fetch current IPv4 **and** IPv6 ranges from [Cloudflare's published list](https://www.cloudflare.com/ips/), using its `ips-v4` and `ips-v6` links. Validate every entry as a CIDR, review the diff, date the snapshot, and use the same list for trust and origin admission. Never trust `0.0.0.0/0`, `::/0`, all private ranges, or arbitrary forwarded headers. Assign an owner to review range updates.
2. Merge the following into an administrator-staged copy of the full Caddyfile. `CF_CIDRS` below is a substitution marker, not executable configuration. Preserve all unrelated sites/options. The global trust change affects shared servers, so review every existing proxy consumer.

```caddyfile
{
    servers {
        trusted_proxies static CF_CIDRS
        trusted_proxies_strict
        client_ip_headers CF-Connecting-IP
    }
}

(henry_api_backend) {
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Forwarded-For {client_ip}
        header_up -CF-Connecting-IP
        header_up -X-Real-IP
        header_up -Forwarded
    }
}
```

Only trusted peer ranges may supply CF-Connecting-IP; other peers resolve to their
socket address. No XFF fallback is configured at Caddy. The API's preferred XFF
is overwritten with that result, and alternative identity headers are removed.
See [Caddy trust options](https://caddyserver.com/docs/caddyfile/options#trusted-proxies),
[upstream header controls](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#headers),
and [client-IP placeholders](https://caddyserver.com/docs/caddyfile/concepts#placeholders).

3. Check that CF's Remove visitor IP headers transform is off for this route and Pseudo IPv4 is not overwriting real addresses. Inventory same-zone Worker subrequests: they can alter CF-Connecting-IP; cross-zone Worker requests may share a fixed address. Do not route public API calls through another Worker as a transparent identity-preserving shortcut. These are documented [Cloudflare header semantics](https://developers.cloudflare.com/fundamentals/reference/http-headers/).
4. Before production, test an isolated Caddy instance with a loopback-only header-echo upstream and a deliberately trusted local test peer. Assert: trusted peer's CF IP becomes exactly one XFF; forged incoming XFF does not survive; untrusted peer's CF/XFF values are ignored; missing CF header falls back safely; IPv6 works. Remove the harness after testing. Never expose a diagnostic echo route publicly or test this by flooding production.
5. Apply the backend snippet to the existing HTTP API site first, validate and reload through the administrator. Check public health and a controlled request's Caddy client-IP log. This fixes identity before enabling the TLS/admission changes below. No persistent raw-header/body logging is needed.

## Stage 4: origin TLS, then admission

**Pending administrator and zone-owner approval.** Preserve the HTTP backend
temporarily so an unknown existing edge-to-origin HTTP mode does not turn into a
redirect loop. Do not simply replace `http://api.henry.ink` with an auto-redirecting
HTTPS-only site before Cloudflare is ready.

1. Choose an origin certificate. For a CF-only origin, the deterministic option here is an Origin CA certificate covering `api.henry.ink`, generated/installed securely by the owner. Set an expiry/rotation owner. Alternatively use a public certificate with a demonstrated ACME renewal path; HTTP/TLS challenges can be affected by proxy/firewall changes, and DNS challenge needs its own scoped credential/module. Never disable certificate verification. [Origin CA](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/), [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).
2. Store the origin certificate and key under `/etc/caddy/certs/`, readable by Caddy but not other application users (for example directory root:caddy 0750, key root:caddy 0640). Add an explicit HTTPS API block while retaining the explicit HTTP block. The paths below are the proposed files, not existing verified files.

```caddyfile
http://api.henry.ink {
    import henry_api_backend
}

https://api.henry.ink {
    tls /etc/caddy/certs/api.henry.ink.pem /etc/caddy/certs/api.henry.ink.key
    import henry_api_backend
}
```

3. Administrator runs `caddy validate --config /etc/caddy/Caddyfile.candidate --adapter caddyfile` with the actual service user's file access, installs the reviewed file, then uses the service's approved reload command (normally `systemctl reload caddy`). Do not stop Caddy or use `restart` unnecessarily. Confirm loaded configuration and unrelated hosts. See [Caddy validation/reload](https://caddyserver.com/docs/command-line).
4. From an allowed test machine, test the origin directly using SNI: `curl --fail --resolve "api.henry.ink:443:$ORIGIN_IP" --cacert "$ORIGIN_CA_ROOT" https://api.henry.ink/api/health`. Use the proper official Origin CA root; omit `--cacert` for a publicly trusted certificate. Test every active A/AAAA target. No `-k`. A normal browser will not trust Origin CA when DNS proxying is disabled.
5. Inspect all other proxied hostnames before changing a zone-wide SSL setting. In Cloudflare, set SSL/TLS encryption to **Full (strict)** only once each affected origin is compatible, or use an approved hostname-scoped Configuration Rule if available and independently permissioned. The zone-wide API operation is `PATCH /zones/{zone_id}/settings/ssl` with body `{"value":"strict"}`; perform through the owner's protected client, then GET and verify. Resolve conflicting origin/configuration rules. Full (strict) validates origin certificate expiry, trust and hostname. [Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).
6. Verify public HTTPS health, archive and CORS without 525/526, redirect loops or certificate errors. Only then replace the HTTP API backend block with `respond 403` (or an approved HTTPS redirect). No API traffic may continue to the origin in cleartext.
7. Restrict the API HTTPS site by **peer** address, using the reviewed CF ranges: `@outside not remote_ip CF_CIDRS`, followed by `respond @outside 403`. Do not use `client_ip` for this admission check: it is the visitor, not the CF peer. Validate/reload and confirm public requests still work while direct-origin requests fail. See [Caddy peer matching](https://caddyserver.com/docs/caddyfile/matchers#remote-ip).
8. Have the administrator review host/provider firewall restrictions for IPv4 and IPv6. Permit only required CF HTTP(S) ingress where compatible with every hosted site; preserve SSH/VPN and recovery access first. Do not apply a global CF-only firewall to this shared VPS without unrelated-site approval. Port 3000 and Caddy admin must remain loopback-only. Never expose the API port as a workaround.

CF ranges alone authenticate Cloudflare's network, **not this zone**. To close
cross-customer origin bypass, obtain separate approval for custom zone/per-hostname
Authenticated Origin Pulls, or a separately designed Tunnel migration. Do not
label an IP allowlist or the shared global AOP certificate zone authentication.
[Origin protection](https://developers.cloudflare.com/fundamentals/security/protect-your-origin-server/).

For approved custom zone-level AOP: owner provisions a dedicated client leaf
certificate/private key and uploads it in SSL/TLS > Origin Server > Authenticated
Origin Pulls > Zone-level; install only its issuing CA certificate at the origin.
In the HTTPS site's existing `tls` block, configure `client_auth` with
`mode verify_if_given` and `trust_pool file { pem_file /etc/caddy/certs/henry-aop-ca.pem }`.
Validate/reload, enable the zone-level AOP toggle, verify client-certificate
presentation, then change to `mode require_and_verify` and recheck. Audit other
zone origins before enabling; certificate scope, availability and renewal remain
approval prerequisites. A no-client-certificate direct request must now fail TLS.
Keep the origin server certificate and AOP client certificate roles separate.
[Custom AOP sequence](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/set-up/zone-level/),
[Caddy client authentication](https://caddyserver.com/docs/caddyfile/directives/tls).

## Stage 5: cache policy

**Pending zone-owner approval.** Start conservatively: bypass edge caching for
the entire `api.henry.ink` hostname. Application/browser caches can remain; do not
add another layer until query keys, Origin variance and asset admission are proven.

1. Export existing cache/Page Rules and order. Add a Cache Rule named `henry API bypass` with exact expression `(http.host eq "api.henry.ink")`, Cache eligibility **Bypass cache**, and no TTL override. Place it after conflicting matching Cache Rules; the last conflicting setting wins. Use Cloudflare Trace to verify matching and inspect Workers/Snippets that could implement their own caching. [Create rule](https://developers.cloudflare.com/cache/how-to/cache-rules/create-dashboard/), [order](https://developers.cloudflare.com/cache/how-to/cache-rules/order/).
2. Preserve origin/browser headers. Do not use Cache Everything, ignore query strings, or force an Edge/Browser TTL over no-store. Bypass may report `DYNAMIC`, not necessarily `BYPASS`. [Cache settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/).
3. After the rule is active, invalidate known stale API URLs if needed, with separate purge approval. Account for the actual existing cache key and full query. Do not purge the whole zone by default. Browser caches, Worker Cache API, Worker KV and SQLite are distinct; an edge purge does not reset them all.
4. Leave Pages' standard asset caching alone. Verify HTML/deep-link routing and OAuth metadata freshness after release; no long immutable TTL for HTML or metadata. Keep hashed assets immutable only where the artifact/platform already guarantees content-addressed filenames.

| Surface | Verified source behavior / required check |
| --- | --- |
| Archive | `Cache-Control: no-store`, `Cloudflare-CDN-Cache-Control: no-store`, `Vary: Origin`. Each response renews in-process exact-asset permissions; edge replay can break asset admission after restart. |
| Margin | `Cache-Control: no-store`, `Vary: Origin`, including its error responses. Never cache user-specific errors/rate limits. |
| Asset proxy | Success: `public, max-age=900`, `Vary: Origin`; admission is checked at the API. Retain edge bypass; do not assume generic `Vary: Origin` creates an edge cache key. |
| Transcript API | Successful transcript responses use `public, max-age=3600`; still bypass edge initially. |
| Are.na / health / preflight | Do not add edge caching. Health is not a cache freshness proof for other paths. |
| Bluesky Worker | Cache API success TTL 600 seconds; session KV is sensitive. Do not bulk delete KV as a cache purge. |
| Legacy Jina / YouTube | Retired with owner approval. Previously cached browser responses cannot be recalled by deleting Workers or KV. Current clients use the VPS API. |

## Stage 6: approved application rollout

Deploy the API before the frontend. No Worker retirement or account migration in
this release. Require a clean deployment checkout and no concurrent branch
updates. Preserve the approved old environment; changing code is not permission
to rotate credentials or change database paths.

The parent's current `deploy:api` does `git pull --ff-only`, frozen install,
verification, restart, then a health loop. **This is not an atomic deployment or
atomic rollback:** pull/install mutate the active code and dependencies before
verification, even when verification prevents restart. Lazy reads or a later
process restart can encounter that changed tree. It does not pin a SHA or roll
back automatically. The pinned in-place procedure below also retains this
non-atomic activation limitation. Prefer the detached
candidate from Stage 2 for preflight and the explicitly pinned activation below.
Do not run `deploy:api` on a detached checkout: its pull assumes a tracking branch.
For routine use of that script, first approve its resulting upstream SHA and
freeze branch updates; a separately approved pinned/release-directory deploy
implementation would remove this operational constraint.

Approved one-time pinned activation, **VPS as henry**, after backup and candidate
success (confirm PM2 watch is off before changing the active tree):

```sh
set -eu
export PATH="/home/henry/.bun/bin:$PATH"
: "${APPROVED_SHA:?set reviewed full commit SHA}"
: "${PREVIOUS_SHA:?record current production SHA}"
cd /home/henry/apps/henry.ink
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = "$PREVIOUS_SHA"
git switch --detach "$APPROVED_SHA"
bun install --frozen-lockfile
testdata=$(mktemp -d)
VITE_API_URL=https://api.henry.ink \
VITE_WORKER_URL=https://bsky-search.henry.ink \
ARENA_DB_PATH="$testdata/channels.db" \
ARCHIVE_CACHE_PATH="$testdata/archive-snapshots.db" bun run verify
pm2 restart henry-ink-api
curl --fail --max-time 5 http://127.0.0.1:3000/api/health
curl --fail --max-time 10 https://api.henry.ink/api/health
```

Stop on any failure and follow Stage 8. No `--update-env` unless the environment
change was separately reviewed: it can import unintended deployment-shell values.
Confirm the preserved PM2 command still executes `api/server.ts` from the expected
cwd. A restart drops in-memory rate limits/admission; browser reload must fetch a
fresh archive before requesting newly admitted assets. Repeated restart loops
are not recovery.

Then deploy Pages from the **same approved revision** on the trusted runner:

```sh
set -eu
: "${APPROVED_SHA:?set reviewed full commit SHA}"
test "$(git rev-parse HEAD)" = "$APPROVED_SHA"
test -z "$(git status --porcelain)"
bun install --frozen-lockfile
# Supply the scoped token through the runner's protected secret environment.
VITE_API_URL=https://api.henry.ink \
VITE_WORKER_URL=https://bsky-search.henry.ink bun run deploy:ink
```

The inspected `deploy:ink` reruns `verify` and uploads only on success. Its hardcoded
account is intentional only after Stage 1 confirms ownership; exporting a
different account ID does not override the assignment inside that script.
Record the new production deployment ID and artifact/source association. Pin the
reviewed Wrangler version in the release toolchain before relying on `bunx`
reproducibility; the inspected root package does not pin Wrangler.
[Direct Upload authentication](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).

## Stage 7: acceptance and retirement gate

1. Check local and public health after restart and record actual deployed SHA/Pages deployment ID. Confirm origin HTTPS plus effective Full (strict), not just a successful edge certificate handshake. Inspect all existing unrelated Caddy sites for regressions.
2. Make a public preflight and GET with `Origin: https://henry.ink`: expect preflight 204, exact allowed origin, appropriate methods and headers. Repeat with an unapproved Origin: no allow-origin header. `henry-note-reader.pages.dev` and arbitrary previews are not in the inspected API allowlist; do not interpret expected preview CORS failure as permission to use `*`.
3. In real Chrome at desktop and mobile widths, open an agreed public article through `https://henry.ink/https://...`; test Original/Text, images/fonts, scrolling, Margin highlight/jump, Are.na, transcript and Bluesky search. Check console/network, source isolation, redirects and OAuth metadata. Do not post/delete real annotations as a smoke test. Exercise actual OAuth login only with explicit user approval.
4. Repeat archive/Margin GETs with the same URL and different Origins. Require no edge HIT/Age growth, correct no-store and CORS headers. For one admitted asset, verify MIME/security headers and the existing browser TTL. Check application cache reuse without confusing it with CDN cache state.
5. From two controlled clients, verify distinct normalized addresses in restricted Caddy logs and single upstream XFF in the isolated harness. Forged XFF/CF headers must not change identity. Verify direct-origin denial on IPv4/IPv6; demonstrate custom AOP if claiming zone-authenticated origin. Rate-limit exhaustion tests belong in staging, not production. Do not expose IPs in public responses.
6. Observe errors, capture latency/resource use and 429s for an agreed window (proposed minimum 24 hours). Preserve all rollback artifacts and old Worker routes. No automatic deletion after a timer.
7. Legacy Jina/YouTube retirement is complete with owner approval. Do not redeploy them as part of a release or recreate deleted KV namespaces. Bluesky remains live and is not part of this retirement.

## Stage 8: rollback

| Failure | Exact recovery boundary |
| --- | --- |
| Candidate gate fails | Do not restart/upload. Running code and Pages remain unchanged if Stage 2 was used. Fix candidate separately. |
| In-place install/gate/API fails | Stop the failed rollout. In the clean VPS checkout run `git switch --detach "$PREVIOUS_SHA"`, `bun install --frozen-lockfile`, then `pm2 restart henry-ink-api`; preserve old env/cwd and check local/public health. If new tracked edits appeared, stop rather than discard them. Never `reset --hard`. |
| Database incompatibility | Stop API before restore. Preserve failed-state DB/WAL/SHM together; restore the integrity-checked backup with correct ownership and no mismatched WAL/SHM, then start the old code. This can lose post-backup writes and requires explicit approval. Do not restore databases for a purely frontend failure. |
| Frontend regression | Pages project > Deployments > previous successful **production** deployment > Rollback to this deployment. Recheck custom domain and API compatibility. Preview deployments cannot be rollback targets. [Pages rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/). |
| Caddy validation fails | Do not reload; active config stays in service. Correct the candidate offline. |
| Caddy/admission regression | Administrator restores saved config, validates with the installed binary, reloads and verifies all sites. Restore only the changed firewall rules through the retained recovery session. If reverting the binary, restore its compatible config first. |
| TLS/strict failure | Prefer fixing certificate/chain/SNI while maintaining strict TLS. Any temporary downgrade is an explicit security rollback: restore the recorded CF setting/rule and the matching old HTTP origin block as a coordinated pair, otherwise loops/outage can persist. Do not silently switch DNS to unproxied or use `-k`. |
| Custom AOP failure | Administrator first relaxes origin client authentication to the previously validated mode, then owner disables/reverts the custom AOP configuration. Disabling CF presentation first while Caddy requires it locks out traffic. Retain peer restrictions. |
| Cache regression | Restore only the changed rule/order from its export; never reinstate known unsafe archive/Margin caching as routine recovery. Keep API bypass while diagnosing. Purge affected edge URLs only with approval; browser/Worker/database caches need distinct recovery. |
| Legacy route retirement failure | Restore that route and prior Worker version/bindings; do not recreate empty KV or assume code rollback restores deleted data/secrets. |

After any rollback, repeat Stage 7's relevant checks, record the reason and active
revisions, and stop the rollout. Do not weaken security, delete data, grant broader
permissions, or retry deployment indefinitely to manufacture a passing result.

## Outstanding approvals and unknowns

- Zone/account ownership, actual token scopes, SSL mode/overrides, DNS targets, cache/rule order, live Worker domains/versions and current Pages deployment remain unverified.
- An administrator's private sudo session is required for Caddy upgrade/configuration, origin certificates/AOP, firewall review and system runtime changes. The owner has password-authenticated sudo; unattended SSH does not.
- PM2's live watch/restart settings are verified. Its inactive boot unit points at the wrong PM2 home; repair and reboot recovery verification remain pending. Effective database paths must be confirmed before application deployment.
- Parent reports a green gate (259 tests, 6 production-bundle browser cases). The committed release SHA and VPS toolchain reconciliation remain pending; this audit did not independently rerun verification or run live browser acceptance.
- Legacy Worker/domain/KV retirement was explicitly approved and completed. Other production changes need their reviewed scope and required access; this document does not approve a zone/account transfer, Tunnel rollout, or public Access wall.
