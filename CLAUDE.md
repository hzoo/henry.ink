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
bun run demo         # Web app demo version (annotation-demo site)
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
  - `demo/` - Annotation demo website
  - `henry-ink/` - henry.ink (renders URL with comments)
  - `styled-content-service/` - Backend experiment for HTML/CSS stripping
- **Shared Components**: `/src/components/` used across extension and demo sites

### Henry's Note (henry-ink/) - Full Web Application

The **henry.ink** website is a full-featured web application that provides annotation capabilities for any URL without requiring a browser extension. It implements the "reverse Hypothesis" approach by recreating webpage content in a controlled environment with integrated social discussions.

#### Core Features
- **Universal URL Support**: Renders any webpage by appending URL to `henry.ink/[url]`
- **Reader Mode**: Clean, readable formatting of web content with markdown rendering
- **Social Annotations**: Integrated Bluesky discussions displayed in sidebar
- **Text Selection & Annotation**: Full annotation capabilities with text highlighting
- **Profile Pages**: View individual users' annotations across different websites
- **No Extension Required**: Works entirely in the browser without downloads

#### Routing Structure
- **`/`** - Landing page with usage instructions and bookmarklet
- **`/profile/:username`** - User profile showing their annotations across sites
- **`/:params*`** - Catch-all route for any URL (e.g., `/https://example.com/article`)
- **Query Parameters**: `?post=rkey` for auto-scrolling to specific discussions

#### Key Components
- **MarkdownSite**: Main content rendering with highlight integration
- **ProfilePage**: User annotation history and activity
- **HighlightController**: Text selection and annotation management
- **Sidebar**: Bluesky discussions and social interactions

#### Usage Patterns
1. **Direct URL**: Visit `henry.ink/https://example.com` for any webpage
2. **Bookmarklet**: One-click access from any page via bookmark bar
3. **Profile Navigation**: Browse user annotations via `/profile/username`
4. **Deep Linking**: Share specific discussions with `?post=` parameters

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
- `/demo/` - Annotation demo website
- `/henry-ink/` - henry.ink URL rendering with comments
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

### Arena Channel Enhancement
- **Wikipedia-style links** to Arena channels found in blog content
- **Aho-Corasick pattern matching** for performance with 100k+ channels
- **Multi-word pattern focus** to avoid false matches (e.g., "web development", "information theory")
- **Title cleaning** removes emojis, special chars from Arena channel names
- **HTML-first processing** - markdown parsed before enhancement to preserve positions
- **Location**: `/henry-ink/arena/` contains the enhancement system

## Testing and Quality

Run `bun run check` for TypeScript validation and `bun run lint` for code formatting. The project uses Biome.js for consistent code style and quality enforcement.