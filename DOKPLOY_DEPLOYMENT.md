# Scambaiter CRM - Dokploy, Traefik, Cloudflare & Supabase Deployment Guide

This guide details how to deploy this application to **Dokploy** with **Traefik** reverse proxy, **Cloudflare SSL & Proxy**, and **Supabase Database**.

---

## 1. Architecture Overview
- **Application Engine:** Node 22 + Express + Vite React TypeScript
- **Database:** Supabase (Cloud PostgreSQL) + Persistent local cache fallback
- **ORM:** Zero Prisma dependencies (Direct Supabase client + typed repository layer)
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
# Supabase Direct Connection String (Recommended)
# Found in Supabase -> Settings -> Database -> Connection string -> URI
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.fanivhbjwfaiezpsawpa.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:[YOUR-PASSWORD]@db.fanivhbjwfaiezpsawpa.supabase.co:5432/postgres

# Or Supabase API / Project URL
DB=https://fanivhbjwfaiezpsawpa.supabase.co
SUPABASE_URL=https://fanivhbjwfaiezpsawpa.supabase.co
SUPABASE_KEY=your-supabase-anon-or-service-role-key

# Administrator credentials
ADMIN_USER=sbadmin@cookiebaits
ADMIN_PASS=sbAdmin2026!#

# Security & Secrets
JWT_SECRET=generate-a-strong-32-character-random-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
APP_URL=https://your-domain.com

PORT=3000
NODE_ENV=production
```

> **Note on Direct Connection String:** When `DATABASE_URL` or `DIRECT_URL` is set to `postgresql://...`, the server connects directly to your Supabase PostgreSQL cluster (port 5432 or port 6543 pooler) and automatically validates and creates all database tables (`users`, `scammers`, `call_logs`, `fraud_accounts`) on startup with zero manual configuration.

---

## 3. Supabase Schema Setup

To initialize or migrate the database tables in your Supabase project:
1. Open your Supabase Dashboard: `https://supabase.com/dashboard/project/fanivhbjwfaiezpsawpa`
2. In the left navigation bar, click on **SQL Editor**.
3. Click **New Query**.
4. Copy and paste the entire script from `supabase-schema.sql` (found in the repository root) into the editor.
5. Click **Run** (or press Ctrl+Enter / Cmd+Enter).
6. Verify that the message `Success. No rows returned` appears. All 4 primary tables (`users`, `scammers`, `call_logs`, `fraud_accounts`), performance indexes, and RLS policies are now active.
7. Note: The CRM application also automatically validates and creates missing tables or missing columns on startup.

---

## 4. Persistent Storage & Cloudflare S3 Backup

### Step A: Persistent Volume
In Dokploy's **Volumes** section:
- **Volume Name:** `scambaiter_db_data`
- **Mount Path:** `/app/data`

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

## 5. Traefik & Cloudflare Proxy Settings

When proxying traffic through Cloudflare (Orange Cloud):
1. **Cloudflare DNS:** Point an `A` or `CNAME` record to your server's public IP with **Proxy status: Proxied (Orange Cloud)**.
2. **Cloudflare SSL/TLS Encryption Mode:**
   - **Full** or **Full (Strict)** is recommended.
   - If using **Flexible**, the container's Traefik configuration handles port 80 (`web`) and forwards `X-Forwarded-Proto=https` so no SSL redirect loops occur.
3. **Dokploy Network:** The container automatically binds to Dokploy's internal `dokploy-network` so Traefik can route traffic directly to internal port `3000`.
4. **Proxy Headers:** Express is configured with `trust proxy: true`, properly capturing `CF-Connecting-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` for accurate audit logs and secure OAuth callbacks.
