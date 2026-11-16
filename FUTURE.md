# Future

Are.na URL discovery currently uses anonymous v2 general search and public block
connections. Move to v3 when v2 is retired or when a single server-side Premium
credential is justified. V3 search requires Premium access; do not silently add
that requirement or fall back to the private GraphQL API. Keep URL-based saves
as the product; do not restore keyword matching or a local channel index.

Sources: [Are.na API documentation](https://www.are.na/developers/explore),
[v3 search](https://www.are.na/developers/explore/search/search).

## Reader delivery

The reader asks the API for a cleaned page on every read and shows it in a
script-free frame beside the discussion. These were considered and deferred;
none is approved:

- **Keep cleaned copies at Cloudflare.** A Pages Function in front of
  `/api/archive` kept one cleaned copy per page in Workers KV (refresh weekly
  when read, forget after about 90 unread days) so a page already read would
  open without the VPS. It was built and removed in November 2026 (branch
  `claude/stored-pages-231d8b`, commits `ae22fb3`..`31f7e7a`). Measured on the
  live site without it: a cold read takes 0.9-1.6 s and a repeat 0.15-0.19 s.
  The stored read's gain was never measured, and it costs an extra hop on first
  reads, a daily Functions allowance shared with Bluesky search, bad first
  captures that last a week, and third-party copies held for 90 days. Revisit
  only after measuring a stored read on a preview deployment, and only with a
  rate-limit rule on the Function so it cannot starve search.
- **The article as the top-level page, discussion in a drawer, login on
  another domain.** Serving the cleaned page as the document at
  `henry.ink/<url>` would make reading work without JavaScript and remove the
  shell-then-fetch wait. It moves untrusted markup into the origin that holds
  the Bluesky session, so login would have to move to a separate origin. Before
  any design work, test that login from a second origin works in Chrome and
  Safari (storage partitioning, popups, redirects).
- **Capture without Chrome.** A plain fetch would be faster and lighter for
  static pages but changes what is captured.
- **Dropping the browser's cleaning pass.** The API now applies the same
  allowlist, but under jsdom's parser. Remove the browser pass only with
  evidence from real browsers that a cleaned page renders to the same DOM.
- **Loading the frame straight from an address** instead of a blob built in
  the browser. Needs the point above first.
- **Cutting any reader feature** for speed.

A smaller follow-up that fits the current design: let the shell start
fetching the cleaned page before the bundle loads.
