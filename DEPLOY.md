# AyuRetreats — Production Deployment Guide

**Stack:** Next.js 14 · FastAPI · PostgreSQL 16 + pgvector · Redis · Nginx
**Target:** AWS EC2 (Ubuntu 24.04) — single instance for MVP
**Estimated time:** 30–45 minutes for first deploy, ~5 minutes for subsequent deploys

---

## Prerequisites

- AWS account with EC2 access
- A domain name (e.g. `ayuretreats.com`) — optional but recommended
- SSH key pair for EC2
- All third-party API keys ready (Stripe, Deepgram, ElevenLabs, etc.)

---

## Part 1 — Launch EC2 Instance

### 1.1 Create the instance

1. Open **AWS Console → EC2 → Launch Instance**
2. Set the following:

   | Setting | Value |
   |---|---|
   | Name | `vaidya-prod` |
   | AMI | Ubuntu Server 24.04 LTS (x86_64) |
   | Instance type | `t3.medium` (min) · `t3.large` (recommended) |
   | Key pair | Create new or select existing — download `.pem` |
   | Root volume | 30 GB · gp3 |

3. Under **Network Settings**, create a new security group with these inbound rules:

   | Port | Protocol | Source | Purpose |
   |---|---|---|---|
   | 22 | TCP | Your IP only | SSH |
   | 80 | TCP | 0.0.0.0/0 | HTTP |
   | 443 | TCP | 0.0.0.0/0 | HTTPS (if not using ALB) |

4. Click **Launch Instance** and wait ~1 minute for it to reach `running` state.

### 1.2 Allocate an Elastic IP (important)

Without an Elastic IP, the instance's public IP changes every reboot.

1. Go to **EC2 → Elastic IPs → Allocate Elastic IP**
2. Click **Allocate**, then **Associate Elastic IP**
3. Select your `vaidya-prod` instance → **Associate**
4. Note the IP — you'll use it throughout this guide as `<SERVER_IP>`

---

## Part 2 — Server Setup

### 2.1 Connect via SSH

```bash
ssh -i /path/to/your-key.pem ubuntu@<SERVER_IP>
```

> **Tip:** Add this to `~/.ssh/config` on your Mac for easy access:
> ```
> Host vaidya
>     HostName <SERVER_IP>
>     User ubuntu
>     IdentityFile /path/to/your-key.pem
> ```
> Then just run `ssh vaidya`.

### 2.2 Install Docker

```bash
# Update packages
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to the docker group (avoids needing sudo)
sudo usermod -aG docker ubuntu
newgrp docker

# Install the Docker Compose plugin
sudo apt-get install -y docker-compose-plugin

# Verify both are working
docker --version
docker compose version
```

### 2.3 Install Git and other tools

```bash
sudo apt-get install -y git curl make nano
```

---

## Part 3 — Deploy the Application

### 3.1 Get the code onto the server

**Option A — Clone from Git (recommended)**

```bash
cd ~
git clone https://github.com/your-org/vaidya.git
cd vaidya
```

**Option B — Copy from your Mac via rsync**

Run this from your local machine:

```bash
rsync -avz \
  --exclude node_modules \
  --exclude .next \
  --exclude __pycache__ \
  --exclude .venv \
  --exclude '*.pyc' \
  -e "ssh -i /path/to/your-key.pem" \
  /Users/sreeharisivadasan/vaidya/ \
  ubuntu@<SERVER_IP>:~/vaidya/
```

### 3.2 Create the production environment file

```bash
cd ~/vaidya
cp .env.production.example .env.production
nano .env.production
```

Fill in every value. The critical ones are:

```env
# Your domain (or http://<SERVER_IP> if no domain yet)
NEXT_PUBLIC_APP_URL=https://ayuretreats.com
NEXT_PUBLIC_API_URL=https://ayuretreats.com

# Database
POSTGRES_PASSWORD=<strong-random-password>
DATABASE_URL=postgresql+asyncpg://vaidya:<strong-random-password>@postgres:5432/vaidya

# Redis
REDIS_PASSWORD=<strong-random-password>
REDIS_URL=redis://:<strong-random-password>@redis:6379/0

# JWT secret — generate with: openssl rand -hex 32
SECRET_KEY=<output-of-openssl-rand-hex-32>

# Stripe, Deepgram, ElevenLabs, Azure, etc.
STRIPE_SECRET_KEY=sk_live_...
```

> **Security:** `chmod 600 .env.production` after editing so only your user can read it.

```bash
chmod 600 .env.production
```

### 3.3 Run the first deploy

```bash
make prod-deploy
```

This single command does three things in order:
1. Builds all Docker images from scratch (`--no-cache`)
2. Starts all containers in the background (`up -d`)
3. Runs any pending database migrations (`alembic upgrade head`)

First run takes **5–10 minutes** (downloading base images, building). Subsequent deploys take ~2 minutes.

### 3.4 Verify everything is running

```bash
# All 5 containers should show "healthy" or "running"
docker compose -f docker-compose.prod.yml ps

# Backend health check
curl http://localhost/health

# Homepage (should return HTML)
curl -I http://localhost/en
```

Expected output for `ps`:

```
NAME               STATUS
vaidya-postgres    Up (healthy)
vaidya-redis       Up (healthy)
vaidya-backend     Up (healthy)
vaidya-frontend    Up
vaidya-nginx       Up
```

---

## Part 4 — Connect Your Domain

### 4.1 Point DNS to the server

In your domain registrar or **AWS Route 53**:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` (or `ayuretreats.com`) | `<SERVER_IP>` | 300 |
| A | `www` | `<SERVER_IP>` | 300 |

Wait 5–15 minutes for DNS to propagate. Test with:

```bash
dig ayuretreats.com +short   # should return <SERVER_IP>
```

### 4.2 Add SSL — Option A: Let's Encrypt (free, self-managed)

Best if you're not using an AWS load balancer.

```bash
# Install certbot
sudo apt-get install -y certbot

# Stop nginx temporarily so certbot can use port 80
docker compose -f docker-compose.prod.yml stop nginx

# Get certificate
sudo certbot certonly --standalone \
  -d ayuretreats.com \
  -d www.ayuretreats.com \
  --email your@email.com \
  --agree-tos --no-eff-email

# Restart nginx
docker compose -f docker-compose.prod.yml start nginx
```

Then update `nginx/nginx.conf` to add an HTTPS server block:

```nginx
server {
    listen 443 ssl;
    server_name ayuretreats.com www.ayuretreats.com;

    ssl_certificate     /etc/letsencrypt/live/ayuretreats.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ayuretreats.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # ... same location blocks as the HTTP server
}

server {
    listen 80;
    server_name ayuretreats.com www.ayuretreats.com;
    return 301 https://$host$request_uri;
}
```

Mount the certs into the nginx container in `docker-compose.prod.yml`:

```yaml
nginx:
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro   # add this line
```

Then restart nginx:

```bash
make prod-restart
```

**Auto-renew** (Let's Encrypt certs expire every 90 days):

```bash
# Add to crontab
sudo crontab -e

# Add this line (runs renewal check every day at 3am)
0 3 * * * certbot renew --quiet && docker compose -f /home/ubuntu/vaidya/docker-compose.prod.yml restart nginx
```

### 4.3 Add SSL — Option B: AWS ALB + ACM (recommended for scaling)

Best for multi-region deployments or if you're on AWS long-term. SSL is terminated at the load balancer — no cert management on the server.

1. **Request a certificate** in **AWS Certificate Manager (ACM)**:
   - Go to ACM → Request → Public certificate
   - Enter `ayuretreats.com` and `*.ayuretreats.com`
   - Choose DNS validation → click **Create records in Route 53**
   - Wait ~5 minutes until status shows `Issued`

2. **Create a Target Group**:
   - EC2 → Target Groups → Create
   - Type: Instances · Protocol: HTTP · Port: 80
   - Health check path: `/health`
   - Register your `vaidya-prod` instance

3. **Create an Application Load Balancer**:
   - EC2 → Load Balancers → Create ALB
   - Internet-facing · Select all AZs in your region
   - Security group: allow 443 from 0.0.0.0/0
   - Add listener: HTTPS 443 → forward to your target group
   - Select the ACM certificate you just created
   - Add a redirect rule: HTTP 80 → HTTPS 443

4. **Update Route 53**:
   - Change the A records to **Alias** pointing to the ALB DNS name

5. Update `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_API_URL` in `.env.production` to `https://ayuretreats.com`, then redeploy:
   ```bash
   make prod-deploy
   ```

---

## Part 5 — Ongoing Operations

### Deploy a code update

```bash
# On your Mac — push changes
git push origin main

# On the server
ssh vaidya
cd ~/vaidya
git pull
make prod-deploy
```

### View logs

```bash
make prod-logs                    # all containers
docker compose -f docker-compose.prod.yml logs -f backend    # backend only
docker compose -f docker-compose.prod.yml logs -f frontend   # frontend only
docker compose -f docker-compose.prod.yml logs -f nginx      # nginx only
```

### Run database migrations (after schema changes)

```bash
make prod-migrate
```

### Open a database shell

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U vaidya -d vaidya
```

### Restart a single container without rebuilding

```bash
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml restart frontend
docker compose -f docker-compose.prod.yml restart nginx
```

### Rebuild a single service only

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  build --no-cache backend
docker compose -f docker-compose.prod.yml --env-file .env.production \
  up -d backend
```

### Check disk and memory usage

```bash
df -h              # disk
free -h            # memory
docker system df   # docker image/container usage
```

### Clean up unused Docker images (free disk space)

```bash
docker image prune -f
docker system prune -f   # removes stopped containers + unused networks too
```

---

## Part 6 — Switching to Managed Services (recommended before going live)

The `docker-compose.prod.yml` bundles PostgreSQL and Redis inside Docker on the same EC2. This is fine for early testing but carries risk for production data. Migrate when you're ready:

### Switch to Supabase (PostgreSQL)

1. Create a project at [supabase.com](https://supabase.com)
2. Enable the **pgvector** extension: Database → Extensions → vector
3. Copy the **Connection string** (Transaction pooler, port 6543)
4. Update `.env.production`:
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:<password>@<host>:6543/postgres
   ```
5. Remove the `postgres` service from `docker-compose.prod.yml`
6. Run `make prod-deploy`

### Switch to AWS ElastiCache (Redis)

1. ElastiCache → Create → Redis OSS cluster
2. Choose the same VPC as your EC2
3. Copy the Primary Endpoint
4. Update `.env.production`:
   ```env
   REDIS_URL=redis://<elasticache-endpoint>:6379/0
   ```
5. Remove the `redis` service from `docker-compose.prod.yml`
6. Run `make prod-deploy`

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `502 Bad Gateway` from nginx | Backend container not healthy | `make prod-logs` — check for DB connection errors |
| Frontend shows old version | Browser cache | Hard refresh `Cmd+Shift+R`, or rebuild with `make prod-deploy` |
| `Cannot find module vendor-chunks` | Stale `.next` directory | `rm -rf frontend/.next && make prod-deploy` |
| DB migration fails | Schema conflict | Check `docker compose exec backend alembic history` |
| Containers exit immediately | Missing env var | `make prod-logs` and look for `KeyError` or `ValidationError` |
| `No space left on device` | Disk full | `docker system prune -f` then `df -h` |
| SSL cert expired | Certbot renewal failed | `sudo certbot renew --force-renewal` |

---

## Quick Reference

```bash
# First deploy
make prod-deploy

# Update after code changes
git pull && make prod-deploy

# View all logs
make prod-logs

# DB migrations
make prod-migrate

# Restart all services
make prod-restart

# Stop everything
make prod-down

# Status check
docker compose -f docker-compose.prod.yml ps
```

---

*Last updated: April 2026 · AyuRetreats MVP v1.0*
