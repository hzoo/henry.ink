# Annotation interoperability

Henry.ink reads existing annotation records before introducing another public schema. The reader should preserve the source site's typography and layout while integrating social context. A standardized reader mode is a fallback, not the primary design. No source-site JavaScript runs in the displayed document; trusted reader JavaScript may manage highlights and navigation.

## Current implementation

`GET /api/annotations/margin?url=<encoded HTTP(S) URL>&offset=0` reads Margin's anonymous targets endpoint. The server uses a fixed upstream, blocks redirects, forwards no credentials, limits each response to 2 MiB, and applies an eight-second deadline through body consumption. Responses are not cached. No indexer or Margin backend code is imported.

The shared `AnnotationView` is a presentation model, not a published lexicon. Record URI and collection remain intact, including legacy Margin records and bookmarks from other collections returned by Margin. `via` identifies the discovery service, not the record's original application. Duplicate record URIs collapse; copies with different record URIs do not.

Body values and bookmark descriptions are untrusted text, even when the declared format is HTML or Markdown. Reference-only bodies remain explicit references and are never fetched; unsupported body forms are marked. Labels are retained for a future display policy. A quote selector carries exact text and surrounding context, but does not establish a match in the current page. Unsupported selectors remain explicitly unsupported rather than becoming page-level notes. Consumers must check target identity, apply moderation, and resolve anchors before inline placement.

The endpoint returns `items`, `skipped`, `target`, and `page`. Margin merges separately paginated URL indexes and filters hidden notes, so page size does not establish completeness. `page.completeness` is always `unknown`; offsets advance upstream by 50. This is bounded discovery, not an exhaustive export.

The reader loads one anonymous Margin page per URL, without persistent caching. The Notes tab shows page notes and unplaced quotes. Labeled notes are conservatively hidden; body formats are displayed as text rather than interpreted HTML. Exact quotes with unique context are placed after the matching paragraph. Bluesky discussion quotes use the same placement mechanism, while unmatched discussion stays in the sidebar. Replies load on demand instead of fetching every thread immediately.

## Schema decision

Retire local code for `ink.henry.annotate.mark` and `ink.henry.annotate.trail`: curation forms, profile and trail routes, AT Protocol writers, preview helpers, lexicon definitions, API routes, backfill, storage code, and the ingester are removed together. Henry.ink is a read-first annotation reader; Bluesky authentication, profiles, discussions, and extension functionality remain.

There are no external users of this curation feature. The local database files in `api/trails/data` were removed after confirming none were open. Production data and remote PDS records remain untouched. No migration scaffolding or automatic remote cleanup is introduced.

Do not add a Henry passage-note schema yet. Revisit one only after existing schemas fail a concrete requirement such as anchor semantics or permissions. Prefer adapting existing records over copying another application's UI or backend.

## Reader boundary

Source HTML and CSS render together as a sanitized same-origin HTML blob in an iframe with `sandbox="allow-same-origin"` but no script permission, reinforced with a document CSP. Blob URLs are revoked on cleanup; unlike `srcdoc`, this preserves legacy rendering modes. Parent-owned reader code handles selection, anchors, and link navigation. The iframe is the style boundary: source selectors, specificity, layers, direct body children, safe root attributes, and recognized legacy rendering modes are retained rather than rewritten around a wrapper. Passive custom HTML containers survive sanitization, but implementations and event handlers do not. Source styles never enter the parent head. Inline note bodies use shadow roots and plain text; CSS Highlights mark resolved quotes without rewriting paragraph markup.

Already-downloaded CSS imports are flattened within the capture's resource budget, preserving their source bases and conditions. Responsive image candidates preserve commas inside CDN URLs. Missing image sources can be recovered from declarative `data-src`/`data-srcset` attributes, then use the same validated asset proxy. Forms lose their submission controls but retain article text. Script-driven typesetting, widgets, media playback, and arbitrary lazy-loading state are not reproduced.

Keep the reader HUD outside that document. Article appearance and annotation interoperability are independent: reading Margin records does not require adopting Margin's UI or standardizing article styling. Bluesky link discussions belong at page level unless a quote is confidently matched. Ambiguous or stale anchors remain visible as unanchored discussion, never attached to an arbitrary passage.

## Evidence as of October 12 2026

- [Margin source](https://github.com/paddinglabs/margin/tree/06a393eab71adfe96aba3c51aee397bc0bd3908b): current `at.margin.note` revision 4 uses W3C-style selectors; the hydrated targets API is distinct from raw repository records. Anonymous live lookup succeeded through this adapter. The repository license is AGPLv3; implementation here uses the public data contract, not copied server code.
- [Semble API](https://docs.cosmik.network/semble-api/cards): URL-linked cards and notes offer useful page-level context, not automatically passage anchors.
- [Seams](https://seams.so) and [Glean specifications](https://tangled.org/julien.rbrt.fr/glean/blob/main/docs/specs.md): candidates for additional read adapters. Public endpoint availability does not prove exhaustive indexing or a stable contract. Add them only with fixtures, bounded requests, and explicit provenance/deduplication behavior.

Focused tests: `bun test api/annotations`.

Local preview: run `bun run api` and `bun run ink`, then open `http://127.0.0.1:3003`. The backend listens on port 3000. The original-layout path and Margin lookup use this backend; Text only still uses the separately configured Jina service. Production deployment and remote record deletion are separate operations.
