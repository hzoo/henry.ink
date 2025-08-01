# Arena Service Deployment Guide

Simple deployment instructions for running the Arena enhancement service.

## Requirements

- Ubuntu VPS (any version)
- Root or sudo access
- Port 3001 available for the Arena service

## Setup Instructions

### 1. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

### 2. Upload Files

Upload the entire `henry-ink/arena/` folder to your VPS at `/app/arena/` (or any location).

```bash
# Example using scp from your local machine:
scp -r henry-ink/arena/ root@your-vps-ip:/app/
```

### 3. Install Dependencies

```bash
cd /app/arena
bun install
```

### 4. Create Data Directory

```bash
mkdir -p data
```

### 5. Set Environment Variables

Create a `.env` file:

```bash
nano .env
```

Add your configuration:

```env
NODE_ENV=production
ARENA_PORT=3001
ARENA_DB_PATH=./data/channels.db
ARENA_CORS_ORIGINS=https://henry.ink,https://arena.henry.ink
```

### 6. Run the Service

#### Option A: Simple Run
```bash
bun run server.ts
```

#### Option B: Background Process
```bash
nohup bun run server.ts > arena.log 2>&1 &
```

#### Option C: With PM2 (Recommended)
```bash
# Install PM2 globally
bun install -g pm2

# Start with PM2
pm2 start server.ts --interpreter bun --name arena-service

# Save PM2 configuration
pm2 save
pm2 startup
```

### 7. Verify It's Running

```bash
# Check if service is running
curl http://localhost:3001/health

# Test enhancement endpoint
curl -X POST http://localhost:3001/enhance \
  -H "Content-Type: application/json" \
  -d '{"content":"test content about machine learning"}'
```

## Domain Setup with Caddy

For production deployment with domain access, use Caddy as a reverse proxy:

### Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### Configure Caddyfile

Create `/etc/caddy/Caddyfile`:

```caddy
# Main app (port 3000)
http://api.henry.ink {
    reverse_proxy localhost:3000
}

# Arena service (port 3001)
http://arena.henry.ink {
    reverse_proxy localhost:3001
}
```

### Start Caddy

```bash
sudo systemctl enable caddy
sudo systemctl start caddy
sudo systemctl status caddy
```

## Maintenance

### View Logs
```bash
# If using PM2
pm2 logs arena-service

# If using nohup
tail -f arena.log
```

### Restart Service
```bash
# If using PM2
pm2 restart arena-service

# If using nohup
pkill -f "bun.*server.ts"
nohup bun run server.ts > arena.log 2>&1 &
```

### Update Code
```bash
# Upload new files, then:
cd /app/arena
bun install  # If dependencies changed
pm2 restart arena-service  # Or restart however you're running it
```

### Reload Caddy (if config changed)
```bash
sudo systemctl reload caddy
# Or if you modified /etc/caddy/Caddyfile
sudo caddy reload --config /etc/caddy/Caddyfile
```