# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **henry.ink** - a social annotation layer for the web. What if every webpage had marginalia for notes? Originally developed as a browser extension for the Community Archive hackathon, it has evolved into a web-first platform at henry.ink that works without any installation. The project maintains both the web application and the original browser extension (Chrome & Firefox) for integrated browsing experiences.

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
bun run ink          # Henry.ink development server (primary)
bun run dev          # Chrome extension development
bun run dev:ff       # Firefox extension development
bun run demo         # Web app demo version (annotation-demo site)

# Building
bun run build        # Build Chrome extension
bun run build:ff     # Build Firefox extension
bun run build:demo   # Build annotation demo
bun run build:ink    # Build henry.ink
bun run zip          # Package for Chrome Web Store
bun run zip:ff       # Package for Firefox Add-ons

# Code Quality
bun run compile      # TypeScript type checking
bun run lint         # Biome linting and formatting (if configured)

# Deployment
bun run deploy:demo      # Deploy demo to Cloudflare Pages
bun run deploy:ink       # Deploy henry.ink to Cloudflare Pages
bun run deploy:bsky_worker # Deploy Bluesky proxy worker
bun run deploy:jina_worker # Deploy Jina proxy worker
bun run release          # Release new version
```

## Architecture

### Multi-Platform Structure
- **henry.ink**: Primary web application at `/henry-ink/` - renders any URL with integrated social discussions
- **Browser Extension**: Original extension platform with entry points in `/entrypoints/`
- **Demo Sites**:
  - `demo/` - Annotation demo website
  - `archive-service/` - Secure web page archiving service
- **Shared Components**: `/src/components/` used across all platforms

### henry.ink Web Application

The **henry.ink** website is the primary platform - a full-featured web application that provides annotation capabilities for any URL without requiring downloads or installation. It implements the "reverse Hypothesis" approach by recreating webpage content in a controlled environment with integrated social discussions.

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

### Browser Extension Architecture (Original Platform)
The browser extension provides integrated annotation capabilities directly within the browser:
- **Entry Points**: `/extension/entrypoints/` contains background, sidepanel, content scripts
- **Side Panel API**: Primary UI in Chrome sidebar
- **Content Scripts**: Text selection and page interaction
- **Background Script**: Cross-tab communication and API calls
- **Context Menus**: Right-click actions for text annotation

### Authentication Flow
- **OAuth 2.0** with Bluesky/AT Protocol
- **Browser-based** using `@atcute/oauth-browser-client`
- **Token persistence** in browser extension storage
- **Enhanced handle resolution** for custom domains with session caching
- **OAuth client metadata** served at `/oauth-client-metadata.json` (new convention)

## Key Directories

- `/henry-ink/` - Primary web application (henry.ink platform)
- `/src/components/` - Shared Preact components used across all platforms
- `/src/hooks/` - Custom hooks (useLike, useRepost, etc.)
- `/src/lib/` - Core utilities, API clients, and state management
- `/extension/` - Browser extension (see extension/README.md for details)
- `/demo/` - Annotation demo website
- `/archive-service/` - Secure web page archiving service
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

## Code Style Guidelines

### Import Patterns
- Use **absolute imports** with `@/` prefix over relative imports
- Never use `import *` syntax - always be explicit with imports

```typescript
// ❌ BAD
import { activeDocuments } from "../store/whiteboard";
import * as utils from "./utils";

// ✅ GOOD
import { activeDocuments } from "@/src/store/whiteboard";
import { specific, functions } from "@/src/utils";
```

### Component Patterns
- Use **PascalCase** for component names
- Hooks must be **inside components** (never at top level)
- Prefer **Preact Signals** over useState for state management
- Split large files into multiple components

```typescript
// ❌ BAD - hooks outside component
const count = useSignal(0);
useEffect(() => {}, []);
function app() {} // wrong casing

// ✅ GOOD
function MyComponent() {
  const count = useSignal(0);
  useEffect(() => {}, []);
}
```

### Preact Signals Usage
- **Global state**: Use `signal()` at module level
- **Component state**: Use `useSignal()` inside components
- **Computed values**: Use `useComputed()` to optimize re-renders

```typescript
// Top-level signals for global state
import { signal } from "@preact/signals";
const globalCount = signal(0);

// Component signals for local state
import { useSignal, useComputed } from "@preact/signals";
function Counter() {
  const count = useSignal(0);
  const double = useComputed(() => count.value * 2);
  return <div>{count.value}</div>;
}
```

### Effect Handling
- Always use **AbortController** for event listeners
- Properly specify dependencies
- Include cleanup functions when needed

```typescript
function MyComponent() {
  useEffect(() => {
    const controller = new AbortController();
    const handler = () => {};
    window.addEventListener('resize', handler, { 
      signal: controller.signal 
    });
    
    return () => controller.abort();
  }, []); // runs only on mount/unmount
}
```

### Styling
- **Tailwind CSS v4** configuration lives in CSS files (not config.js)
- Use `@theme` directive for custom design tokens

```css
@import "tailwindcss";

@theme {
  --color-discord-dark: oklch(0.24 0.02 264.05);
}
```

## OAuth Implementation Details

### Handle Resolution Enhancement
The project includes custom handle resolution for improved performance and decentralization:

- **Direct HTTP resolution** for custom domains (checks `/.well-known/atproto-did`)
- **Session-based caching** to avoid repeated lookups
- **1-second timeout** for fast fallback to default resolver
- **Automatic fallback** to Bluesky's resolver if direct resolution fails

Location: `demo/lib/handle-resolver.ts`

### OAuth Client Metadata
- Client metadata now served at root level: `/oauth-client-metadata.json`
- This follows the new atcute convention for cleaner authorization flows
- Configuration managed via `scripts/inject-oauth-plugin.ts` for different build targets

## Testing and Quality

Run `bun run compile` for TypeScript validation. The project uses Biome.js for consistent code style and quality enforcement (when configured).