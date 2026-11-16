# Future

Are.na URL discovery currently uses anonymous v2 general search and public block
connections. Move to v3 when v2 is retired or when a single server-side Premium
credential is justified. V3 search requires Premium access; do not silently add
that requirement or fall back to the private GraphQL API. Keep URL-based saves
as the product; do not restore keyword matching or a local channel index.

Sources: [Are.na API documentation](https://www.are.na/developers/explore),
[v3 search](https://www.are.na/developers/explore/search/search).

## Reader delivery

Kept pages are served from Cloudflare KV by a Pages Function, into the same
script-free frame beside the discussion. These were considered and deferred;
none is approved:

- **The article as the top-level page, discussion in a drawer, login on
  another domain.** Serving the kept copy as the document at `henry.ink/<url>`
  would make reading work without JavaScript and remove the shell-then-fetch
  wait. It moves untrusted markup into the origin that holds the Bluesky
  session, so login would have to move to a separate origin. Before any design
  work, test that login from a second origin works in Chrome and Safari
  (storage partitioning, popups, redirects).
- **Capture without Chrome.** A plain fetch would be faster and lighter for
  static pages but changes what is captured.
- **Dropping the browser's cleaning pass.** The API now applies the same
  allowlist, but under jsdom's parser. Remove the browser pass only with
  evidence from real browsers that a kept copy renders to the same DOM.
- **Loading the frame straight from a kept-copy address** instead of a blob
  built in the browser. Needs the point above first.
- **Cutting any reader feature** for speed.

Smaller follow-ups that fit the current design: let the shell start fetching
the kept copy before the bundle loads; keep images and fonts too, so a page
outlives its source's assets; drop the API's own 24-hour SQLite snapshot cache
now that KV holds the kept copy.
