# henry.ink

A social annotation layer for the web: open any page at `henry.ink/<url>` and read it with its discussion from Bluesky, Are.na, and other sources alongside. It works the reverse of Hypothesis. We don't overlay notes on someone else's page; we re-render the page inside our own reader, so highlights and comments are part of the same surface.

## Project Theory

**INTEGRATED READING.** Notes and source should feel like one surface, not an overlay bolted on later.
**RENDER, DON'T DECORATE.** Rebuild the reading experience inside henry.ink when that creates a cleaner whole.
**SOCIAL CONTEXT IS MATERIAL.** Bluesky, Are.na, and adjacent context belong in the reading flow when they sharpen understanding.
**STABLE READER HUD.** Reader chrome stays anchored; content and discussion move inside it.
**DIRECT SHAPES WIN.** Prefer direct API and data shapes that match the product over wrappers built for another interface.

## Map

- `henry-ink/` - the web app, and the primary product. Routes: `/`, `/profile/:username`, and a catch-all `/<url>` (`?post=<rkey>` scrolls to a discussion).
- `api/` - the Bun API server (archive, Arena, YouTube, Margin). It has its own `AGENTS.md`.
- `extension/` - the original browser extension (Chrome and Firefox, WXT). A self-contained workspace with its own dependencies and tsconfig.
- `demo/` - the annotation demo site. OAuth setup and sign-in live in `demo/lib/oauth.ts`.
- `src/` - code shared by all of the above: `components/`, `hooks/`, `lib/`.

Stack: Preact, Preact Signals, TanStack Query, Tailwind v4, `@atcute` for AT Protocol, Bun, Cloudflare Pages.

## Commands

```bash
bun run ink          # web app dev server
bun run api          # API server on 127.0.0.1:3000
bun run dev          # extension dev (Chrome); more in extension/package.json
bun run demo         # demo site
bun run compile      # typecheck (compile:api for the API)
bun run test         # unit tests (test:browser adds the browser capture tests)
bun run verify       # full pre-deploy check; deploy:ink runs it first
```

Deploys (`deploy:ink`, `deploy:api`, `deploy:demo`, `deploy:bsky_worker`) and `release` are in `package.json`; see `DEPLOYMENT.md`.

## Conventions

- Import with the `@/` alias from the repo root (`@/src/lib/...`), never relative paths or `import *`.
- State is Preact Signals, not `useState`: `signal()` at module level for global state (`src/lib/signals.ts`), `useSignal()` and `useComputed()` inside components. Server state goes through TanStack Query hooks. Settings live in `src/lib/settings.ts`.
- Event listeners added in an effect take an `AbortController` signal, and the cleanup aborts it.
- Tailwind v4 is configured in CSS with `@theme`, not in a config file.
- The Bluesky client is `src/lib/bsky.ts`. Likes and reposts update optimistically.
- OAuth uses `@atcute/oauth-browser-client`. Callback parsing is in `src/lib/oauth-callback.ts`; client metadata is served at `/oauth-client-metadata.json` and injected per build target by `scripts/inject-oauth-plugin.ts`.
