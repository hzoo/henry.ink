# Archive Service

## Purpose
This service creates secure archives of web pages by capturing the full HTML content and validating CSS with Lightning CSS. It strips JavaScript for security while preserving visual styling and fonts.

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
# Start development server
bun run dev

# Build for production  
bun run start
```

## API Endpoints

### POST `/api/archive`
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
  "title": "Page Title",
  "author": "Author Name", 
  "domain": "example.com",
  "url": "source URL",
  "extractionTime": 1500,
  "contentSize": 45000
}
```

### GET `/api/font-proxy`
Proxies non-Google fonts with validation.

**Query Parameters:**
- `url` - Font URL to proxy

**Security:**
- Validates content type is font/*
- Checks file size limit (5MB)
- Only allows recently extracted domains
- Includes trusted CDN whitelist

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