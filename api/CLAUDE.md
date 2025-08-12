# API Services

## Overview
Unified API server providing Arena and Archive services through a single endpoint. Contains modular services for content enhancement and web page archiving.

## Services

### Archive Service
Creates secure archives of web pages by capturing the full HTML content and validating CSS with Lightning CSS. It strips JavaScript for security while preserving visual styling and fonts.

### Arena Service  
Enhances content with Arena channel links using pattern matching and provides search/discovery capabilities for Arena channels.

## Key Goals
- Create secure archives without JavaScript execution risks
- Preserve original visual styling (fonts, colors, layout)
- Load Google Fonts directly (trusted) and proxy other fonts
- Validate CSS with Lightning CSS for compatibility and security
- Minimal archive.today-style interface

## Architecture

### Backend (`src/archive-processor.ts`)
- Uses Playwright headless browser to capture full page content
- Strips all JavaScript and event handlers for security
- Validates and processes CSS with Lightning CSS
- Handles Google Fonts directly, proxies other fonts
- Preserves html/body attributes in wrapper divs
- Creates minimal fixed archive banner

### Frontend (`public/index.html`)
- Single-page archive interface with integrated controls
- Displays archived content directly in the page
- Updates header after archiving to show source info
- Maintains minimal 24px header like archive.today

## Security Features

### JavaScript Removal
- Removes all `<script>` tags
- Strips event handlers (`onclick`, `onload`, etc.)
- Removes `javascript:` URLs from href/src attributes
- Prevents execution of any client-side code

### CSS Validation
- Lightning CSS validates and minifies all CSS
- Conservative browser targets for JSDOM compatibility
- Rejects CSS with dangerous features or syntax errors
- Preserves only safe, validated styles

### Font Security
- Google Fonts loaded directly (trusted CDN)
- Other fonts proxied through validation
- Font proxy validates content type and file size
- Domain tracking prevents font abuse

## Development Commands

```bash
# Unified API server (production)
bun start                # Port 3000 - all services

# Individual service testing
bun run dev:archive     # Port 3002 - Archive service only (with test page)

# From project root
bun run api             # Start unified API server
bun run dev:archive     # Start archive dev server
```

## API Endpoints

### Archive Service

#### POST `/api/archive`
Creates a secure archive of a web page.

**Request:**
```json
{
  "url": "https://example.com/article"
}
```

**Response:**
```json
{
  "html": "archived HTML with security processing",
  "css": "processed and validated CSS",
  "title": "Page Title",
  "author": "Author Name", 
  "domain": "example.com",
  "url": "source URL",
  "extractionTime": 1500,
  "contentSize": 45000
}
```

#### GET `/api/font-proxy`
Proxies non-Google fonts with validation.

**Query Parameters:**
- `url` - Font URL to proxy

### Arena Service

#### POST `/api/arena/enhance`
Enhances content with Arena channel links.

**Request:**
```json
{
  "content": "text content to enhance",
  "url": "https://example.com/page",
  "options": { "minWords": 2 }
}
```

#### POST `/api/arena/search`
Searches Arena channels and saves to database.

**Request:**
```json
{
  "query": "search term"
}
```

#### POST `/api/arena/channel-blocks`
Fetches blocks for a specific Arena channel.

**Request:**
```json
{
  "slug": "channel-slug",
  "per": 5,
  "page": 1
}
```

### Health Checks

#### GET `/api/health`
Unified API health check.

## Technical Details

### Archive Process
1. Load page with Playwright (JavaScript enabled for rendering)
2. Extract external CSS and inline into document
3. Process fonts (Google Fonts direct, others proxied)
4. Validate CSS with Lightning CSS
5. Strip JavaScript and event handlers
6. Preserve html/body attributes in wrapper divs
7. Add minimal archive banner

### CSS Processing
- Lightning CSS transforms with conservative browser targets
- Minifies and validates CSS for security
- Handles modern CSS features by downgrading for compatibility
- Suppresses JSDOM CSS parsing errors (validation handled by Lightning CSS)

### HTML/Body Preservation
- Extracts classes and styles from html/body tags
- Applies to wrapper divs to maintain layout
- Preserves language attributes and custom styling
- Pushes content down to avoid header overlap

## Security Model
- HTTPS-only URL validation
- CSP headers prevent script execution
- Domain tracking for font proxy access control
- Lightning CSS validation rejects unsafe CSS
- Complete JavaScript removal from archived content