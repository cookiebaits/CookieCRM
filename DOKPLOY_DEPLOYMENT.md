# Scambaiter CRM - Dokploy, Traefik & Cloudflare S3 Deployment Guide

This guide details how to deploy this application to **Dokploy** with **Traefik** reverse proxy, **Cloudflare SSL & Proxy**, and automated backups to **Cloudflare R2 / S3 storage**.

---

## 1. Architecture Overview
- **Application Engine:** Node 22 + Express + Vite React TypeScript
- **Database:** SQLite managed via Prisma ORM (`/app/prisma/scambaiter.db`)
- **Container Host:** Dokploy Application (Docker Compose or Dockerfile deployment)
- **Edge Routing:** Traefik on port `3000` with automated Let's Encrypt TLS
- **Edge CDN & DDoS Protection:** Cloudflare (Proxy enabled `orange cloud`)
- **Automated Backup:** Dokploy Backup service targeting Cloudflare R2 (S3-compatible API)

---

## 2. Dokploy Application Configuration

1. In your Dokploy dashboard, navigate to **Applications** -> **Create Application**.
2. Source: Select **Git** and connect your repository.
3. Build Type: Choose **Dockerfile** or **Docker Compose**.
4. Set the internal port to `3000`.

### Environment Variables:
Add the following in the Dokploy **Environment** tab:
```env
# Database parameter (auto-formatted to file: protocol automatically)
DB=/app/prisma/scambaiter.db
DATABASE_URL=file:/app/prisma/scambaiter.db

# Administrator credentials
ADMIN_USER=sbadmin@cookiebaits
ADMIN_PASS=sbAdmin2026!#

# Security & Secrets
JWT_SECRET=generate-a-strong-32-character-random-key
GEMINI_API_KEY=your-gemini-api-key-here
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
APP_URL=https://your-domain.com

PORT=3000
NODE_ENV=production
```

> **Note on `DB=` and `DATABASE_URL=`:** The container includes an automated preflight script (`scripts/prepare-db.js`) that automatically validates, normalizes, and prepends the required `file:` protocol to any path you enter (e.g. `DB=/app/prisma/scambaiter.db` or `DB=./scambaiter.db`), creates directories with full read/write permissions, and eliminates Prisma P1012 validation errors.

---

## 3. Persistent Storage & Cloudflare S3 Backup

### Step A: Persistent Volume
In Dokploy's **Volumes** section:
- **Volume Name:** `scambaiter_db_data`
- **Mount Path:** `/app/prisma`

### Step B: Cloudflare S3 / R2 Backup in Dokploy
1. In Cloudflare Dashboard, navigate to **R2 Object Storage** -> **Create Bucket** (e.g. `dokploy-backups`).
2. Generate an **R2 API Token** (Admin Read & Write permissions):
   - Access Key ID
   - Secret Access Key
   - Endpoint URL: `https://<account_id>.r2.cloudflarestorage.com`
3. In Dokploy, go to **Destinations** -> **Create Destination**:
   - Provider: **S3 / Cloudflare R2**
   - Bucket: `dokploy-backups`
   - Access Key & Secret Key
   - Region: `auto`
4. Under your Application's **Backups** tab:
   - Target Volume: `scambaiter_db_data`
   - Schedule: Cron expression (e.g. `0 3 * * *` for daily at 3:00 AM)
   - Retention: Keep last 14 backups.

---

## 4. Traefik & Cloudflare Proxy Settings

When proxying traffic through Cloudflare (Orange Cloud):
1. **Cloudflare DNS:** Point an `A` or `CNAME` record to your server's public IP with **Proxy status: Proxied (Orange Cloud)**.
2. **Cloudflare SSL/TLS Encryption Mode:**
   - **Full** or **Full (Strict)** is recommended.
   - If using **Flexible**, the container's Traefik configuration handles port 80 (`web`) and forwards `X-Forwarded-Proto=https` so no SSL redirect loops occur.
3. **Dokploy Network:** The container automatically binds to Dokploy's internal `dokploy-network` so Traefik can route traffic directly to internal port `3000`.
4. **Proxy Headers:** Express is configured with `trust proxy: true`, properly capturing `CF-Connecting-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` for accurate audit logs and secure OAuth callbacks.

---

## 5. Automated Migrations & Engine Support

- **Automated Schema Sync:** The `docker-entrypoint.sh` executes the preflight sanitizer followed by `npx prisma db push --skip-generate --accept-data-loss` on every container start.
- **OpenSSL 3.x Compatibility:** Debian Bookworm native OpenSSL 3.x engines (`debian-openssl-3.0.x`) and `libssl3` packages are pre-compiled and bundled, eliminating OpenSSL version detection warnings.
