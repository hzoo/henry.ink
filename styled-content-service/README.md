# Styled Content Service MVP

Extract styled content from web pages while preserving visual appearance.

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

Test the service:
```bash
bun run test.ts
```

## API

### POST /api/extract

Request:
```json
{
  "url": "https://example.com/article"
}
```

Response:
```json
{
  "html": "<article>cleaned content</article>",
  "title": "Article Title",
  "author": "Author Name",
  "domain": "example.com",
  "image": "https://example.com/image.jpg",
  "publishedTime": "2024-01-01T12:00:00Z",
  "url": "https://example.com/article",
  "styles": { ... },
  "extractedCSS": [ ... ],
  "fontUrls": [ ... ]
}
```

## Features

- ✅ Mobile viewport simulation (375×812)
- ✅ Remove hidden/clutter elements  
- ✅ Smart content detection
- ✅ Inline styles preservation
- ✅ Metadata extraction
- ✅ CORS support

## Next Steps

- Add Defuddle integration for better content detection
- Add per-domain custom CSS overrides
- Add caching layer
- Add more robust error handling