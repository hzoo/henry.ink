# Archive Service

Create secure archives of web pages with Lightning CSS validation.

## Setup

```bash
bun install
npx playwright install chromium
```

## Usage

Start the server (port 3000):
```bash
bun run dev
```

## API

### POST /api/archive

Request:
```json
{
  "url": "https://example.com/article"
}
```

Response:
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

### GET /api/font-proxy

Proxies non-Google fonts with validation.

Query: `?url=https://example.com/font.woff2`

## Security Features

- ✅ JavaScript removal (scripts, event handlers, javascript: URLs)
- ✅ Lightning CSS validation and minification  
- ✅ Google Fonts direct loading (trusted)
- ✅ Font proxy with domain validation
- ✅ HTTPS-only URL validation
- ✅ CSP headers prevent script execution