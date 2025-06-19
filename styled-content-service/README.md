# Styled Content Service MVP

Extract styled content from web pages while preserving visual appearance.

## Setup

```bash
bun install
npx playwright install chromium
```

## Usage

Start the server:
```bash
bun run dev
```

Test the service:
```bash
bun run test.ts
```

## API

### POST /process-url

Request:
```json
{
  "url": "https://example.com/article"
}
```

Response:
```json
{
  "html": "<article style='...'>cleaned content with inline styles</article>",
  "metadata": {
    "title": "Article Title",
    "author": "Author Name",
    "domain": "example.com",
    "favicon": "/favicon.ico",
    "image": "https://example.com/image.jpg",
    "published": "2024-01-01"
  }
}
```

## Features

- ✅ Mobile viewport simulation (375px width)
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