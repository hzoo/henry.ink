# AGENTS.md

This file guides coding agents working in this repository.

## Project Overview

**henry.ink** is marginalia for the web. Visit `henry.ink/<url>` to read any page
with its Bluesky, Are.na and Margin discussions beside it, without installing
anything. A Chrome and Firefox extension shows the same sidebar while browsing.

## Project Theory

henry.ink re-renders a page at `henry.ink/<url>` so it can carry highlights,
annotations, and the conversation about it. Annotations only work this well
inside a browser extension, and we are not building a browser, so this is the
next best thing.

**THE ORIGINAL, FASTER.** Render as close to the source as possible, as fast as possible, readable without JavaScript. Text-heavy blogs first.
**CDN-FAST, STILL SAFE.** Reading should feel edge-cached. Speed never trades away sanitizing untrusted HTML or keeping the backend private.
**EVERY CONVERSATION.** Gather discussion wherever it is free to read: Bluesky, Are.na. X/Twitter belongs too, but its API costs too much.
**LINK EVERYTHING TO EVERYTHING.** Every page is a doorway; hyperlinks and discussions connect each site to all the others. All roads lead to the truth, Jesus: the word is a rabbit hole to the living Word.
**CHOOSE NOT TO.** Drop features that slow the read or blur the purpose.
**STABLE READER HUD.** Reader chrome stays anchored; content and discussion move inside it.
**DIRECT SHAPES WIN.** Prefer direct API and data shapes that match the product over wrappers built for another interface.

## Stack

Preact with Signals, TanStack Query, Tailwind CSS v4, Vite, WXT for the
extension, Bun for the API and tooling, and `@atcute` for AT Protocol.

## Commands

The web app, extension, and local API need no env file or credentials.
Browser builds use the deployed public services. To test backend edits, run
`bun run api` and `VITE_API_URL=http://localhost:3000 bun run ink`. Only the
Bluesky search Worker needs bot credentials, in `.dev.vars`. Deployment
runbooks are private; never commit them.

```bash
bun run ink            # henry.ink dev server at http://127.0.0.1:3003
bun run ext            # Extension dev (Chrome); `cd extension && bun run dev:ff` for Firefox
bun run api            # Local API on port 3000

bun run build:ink      # Also build:ext
bun run compile        # Type-checks web, API, extension and Worker
bun run test           # Unit tests; test:browser adds Chrome capture tests
bun run verify         # Everything deploys require

bun run deploy:ink     # henry.ink to Cloudflare Pages
bun run deploy:search  # Bluesky search Worker (bsky-search.henry.ink)
bun run deploy:api     # Verify, then deploy main to the API server
```

With more than one Cloudflare account, set `CLOUDFLARE_ACCOUNT_ID` in the
ignored `.env`; Wrangler reads it from there.

## Layout

- `henry-ink/`: the web app. `/` is the landing page, `/profile/:username`
  a profile, and every other path a reader for that URL (`?post=rkey` jumps
  to a discussion).
- `src/`: components, hooks and libraries shared with the extension.
  `src/lib/worker.ts` is the Bluesky search Worker.
- `extension/`: the WXT extension (side panel, background, selection popup).
- `api/`: the Bun API on the VPS: article snapshots, the asset proxy, Are.na
  and Margin lookups, YouTube transcripts. `ops/` holds its systemd unit and
  deploy script.

The reader boundary (sanitized, script-free iframe; parent-owned highlights)
is documented in `api/annotations/README.md`. Keep it.

## Are.na

The sidebar finds saved copies of the current page with public v2 search,
filters by the actual source URL, and reads their public channel connections,
only when its tab is opened. It needs no article content or credentials. A
channel owner is not necessarily the person who connected a block. Do not
inject keyword links into article text, build a channel index, or send
selected text to Are.na. V3 search requires Premium, so moving to it is a
product decision, not a fallback.

## Code style

- Absolute imports with the `@/` prefix; no `import *`.
- Preact Signals over `useState`: `signal()` for global state, `useSignal()`
  and `useComputed()` inside components.
- Remove event listeners with an `AbortController`.
- Tailwind v4 is configured in CSS (`@theme`), not a config file.
