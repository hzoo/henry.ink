# Arena Service Deployment Guide

Simple deployment instructions for running the Arena service on Ubuntu VPS.

## Requirements

- Ubuntu VPS (any version)
- Root or sudo access
- Open port 3001 (or your chosen port)

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
ARENA_CORS_ORIGINS=https://henry.ink,https://www.henry.ink
ARENA_APP_TOKEN=your_arena_app_token_here
ARENA_AUTH_TOKEN=your_arena_auth_token_here
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

# View stats
curl http://localhost:3001/stats
```

## Optional: Domain Setup with Nginx

If you want to use a domain (e.g., api.henry.ink) instead of IP:3001:

```bash
# Install Nginx
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/arena-api
```

Add this configuration:

```nginx
server {
    server_name api.henry.ink;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and get SSL:

```bash
sudo ln -s /etc/nginx/sites-available/arena-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.henry.ink
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