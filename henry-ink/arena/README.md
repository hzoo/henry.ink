# Arena Service

Arena channel link enhancement service for henry.ink.

## Directory Structure

```
henry-ink/arena/
├── server.ts              # Main Bun server
├── channel-storage.ts     # SQLite database operations
├── pattern-matcher.ts     # Pattern matching logic
├── link-enhancer.ts       # Content enhancement
├── data/                  # SQLite database files
├── .env                   # Environment configuration
├── DEPLOY.md             # Deployment instructions
└── README.md             # This file
```

## Local Development

```bash
# From henry-ink/arena/ directory

# Create environment file if needed
cp .env.example .env  # or create manually

# Install dependencies
bun install

# Start service
bun run server.ts
```

### Environment Variables (.env)
```bash
ARENA_PORT=3001
ARENA_DB_PATH=./data/channels.db
ARENA_CORS_ORIGINS=http://localhost:3004,http://127.0.0.1:3004
NODE_ENV=development
```

## Deployment

See [DEPLOY.md](./DEPLOY.md) for deployment instructions.

## API Endpoints

- `POST /enhance` - Enhance content with Arena channel links
- `POST /api/search-arena` - Search Arena channels and save to database
- `GET /health` - Health check

## Tech Stack

- **Runtime**: Bun (native TypeScript execution)
- **Database**: SQLite (stores Arena channel data)
- **Pattern Matching**: Aho-Corasick algorithm for efficient multi-pattern search