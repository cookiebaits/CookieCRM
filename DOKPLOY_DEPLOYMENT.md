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
DATABASE_URL=file:/app/prisma/scambaiter.db
JWT_SECRET=generate-a-strong-32-character-random-key
GEMINI_API_KEY=your-gemini-api-key-here
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
PORT=3000
NODE_ENV=production
```

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

When proxying traffic through Cloudflare:
1. In Cloudflare DNS, set an `A` or `CNAME` record pointing to your server's public IP with **Proxy status: Proxied (Orange Cloud)**.
2. Under **SSL/TLS**, set encryption mode to **Full (Strict)**.
3. Traefik automatically routes incoming HTTPS traffic to port `3000` using the labels in `docker-compose.yml`.

---

## 5. Automated Migrations

The `docker-entrypoint.sh` script executes `npx prisma db push --skip-generate` on every container spin-up. Schema additions or changes in `prisma/schema.prisma` are applied without manual intervention during Dokploy CI/CD rebuilds.
