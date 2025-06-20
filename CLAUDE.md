# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Bluesky Sidebar** - a browser extension (Chrome & Firefox) with multiple demo websites that shows Bluesky discussions about the current webpage. The extension provides annotation capabilities and social interactions directly in the browser sidebar.

## Conceptual Overview

This project takes a "reverse Hypothesis" approach to web annotations. Instead of overlaying annotations on existing webpages (like traditional annotation tools), we recreate the webpage content within our own environment. This gives us full control over the UI, enabling seamless integration of comments with the original content - such as automatically highlighting annotated text. The goal is to create a unified reading experience where blog posts and their associated discussions from Bluesky, Are.na, and other sources feel naturally integrated rather than bolted on.

## Technology Stack

- **Framework**: Preact (React-like, optimized for performance)
- **Build Tool**: WXT (Modern browser extension framework)
- **Language**: TypeScript with strict configuration
- **Styling**: Tailwind CSS v4 with Vite plugin
- **Package Manager**: Bun
- **State Management**: Preact Signals
- **Data Fetching**: TanStack Query with persistence
- **Backend**: Bluesky/AT Protocol via `@atcute` libraries
- **Linting**: Biome.js (replaces ESLint/Prettier)

## Development Commands

```bash
# Development
bun run dev          # Chrome extension development
bun run dev:ff       # Firefox extension development
bun run site         # Web app demo version (annotation-demo site)
bun run notes        # Note-taking variant (henry.ink)

# Building
bun run build        # Build Chrome extension
bun run build:ff     # Build Firefox extension
bun run zip          # Package for Chrome Web Store
bun run zip:ff       # Package for Firefox Add-ons

# Code Quality
bun run check        # TypeScript type checking
bun run lint         # Biome linting and formatting

# Deployment
bun run deploy:demo      # Deploy demo to Cloudflare Pages
bun run deploy:notes     # Deploy notes app
bun run deploy:bsky_worker # Deploy Bluesky proxy worker
bun run release          # Release new version
```

## Architecture

### Multi-Platform Structure
- **Extension**: Main browser extension with entry points in `/entrypoints/`
- **Demo Sites**:
  - `site/` - Annotation demo website
  - `note-site/` - henry.ink (renders URL with comments)
  - `styled-content-service/` - Backend experiment for HTML/CSS stripping
- **Shared Components**: `/src/components/` used across extension and demo sites

### State Management Pattern
- **Global state**: Preact Signals in `/src/lib/signals.ts`
- **Component state**: `useSignal()` hooks
- **Server state**: TanStack Query with browser storage persistence
- **Settings**: Centralized in `/src/lib/settings.ts`

### Extension Architecture
- **Entry Points**: `/entrypoints/` contains background, sidepanel, content scripts
- **Side Panel API**: Primary UI in Chrome sidebar
- **Content Scripts**: Text selection and page interaction
- **Background Script**: Cross-tab communication and API calls
- **Context Menus**: Right-click actions for text annotation

### Authentication Flow
- **OAuth 2.0** with Bluesky/AT Protocol
- **Browser-based** using `@atcute/oauth-browser-client`
- **Token persistence** in browser extension storage

## Key Directories

- `/entrypoints/` - Extension entry points (background, sidepanel, content)
- `/src/components/` - Shared Preact components used across extension and demos
- `/src/hooks/` - Custom hooks (useLike, useRepost, etc.)
- `/src/lib/` - Core utilities, API clients, and state management
- `/site/` - Annotation demo website
- `/note-site/` - henry.ink URL rendering with comments
- `/styled-content-service/` - Backend experiment for content extraction
- `/public/` - Static assets and extension manifest

## Development Patterns

### Component Design
- Functional components with TypeScript interfaces
- Composition over inheritance pattern
- Shared components between extension and demo sites
- Modular post components with consistent interfaces

### API Integration
- Centralized Bluesky API client in `/src/lib/bsky.ts`
- Query hooks for data fetching with caching
- Optimistic updates for social actions (like, repost)
- Error handling with user-friendly messages

### Extension-Specific Patterns
- Message passing between content scripts and background
- Storage APIs for settings and authentication tokens
- Tab management for URL monitoring and auto-discovery
- Permissions handling for cross-origin requests

## Testing and Quality

Run `bun run check` for TypeScript validation and `bun run lint` for code formatting. The project uses Biome.js for consistent code style and quality enforcement.