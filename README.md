# 🛡️ Scambaiter CRM

Scambaiter CRM is an open-source, full-stack Customer Relationship Management (CRM) platform engineered specifically for scambaiters, counter-fraud researchers, and cybersecurity intelligence analysts. It allows users to track scam operations, log scammer contact details, store call recordings & evidence notes, analyze fraud trends, and generate AI-assisted bait strategies using Google Gemini.
# Run and deploy your AI Studio app

---

## ⚡ Key Features

- **Lead & Scammer Management:** Catalog and track scam operations, fraud categories (Tech Support, Refund, Crypto, Romance, IRS/Tax), phone numbers, email addresses, and active statuses.
- **Call & Evidence Logging:** Log call interactions, record timestamps, note scammer tactics, and link evidence artifacts to specific scammer profiles.
- **AI-Powered Bait Assistant:** Integrated with Google Gemini API to analyze scam emails/transcripts, generate convincing persona responses, and extract actionable threat intelligence.
- **Analytics & Reporting:** Interactive dashboards powered by Recharts providing visual breakdowns of scam types, success rates, and active threat targets.
- **Authentication & Security:** Secure JWT-based local user authentication and Google OAuth 2.0 integration with role-based access control.
- **Automated Database Persistence:** SQLite database managed via Prisma ORM with automated schema push during deployment and persistent volume support.

---

## 🌐 Network Ports Utilized

| Service | Container Port | Host Port | Protocol | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Scambaiter CRM** | `3000` | `3000` | HTTP / WebSockets | Full-stack Node.js Express server & Vite React frontend |

---

## ⚙️ Environment Variables

Configure the following environment variables in your deployment settings or `.env` file:

```env
# Application Settings
NODE_ENV=production
PORT=3000
APP_URL=https://scambaiter.yourdomain.com

# Database Path (Prisma SQLite)
DATABASE_URL=file:/app/prisma/scambaiter.db

# Security & Authentication
JWT_SECRET=your-secure-random-32-character-secret-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com

# AI Integration
GEMINI_API_KEY=your-google-gemini-api-key
```

---

## 🚀 Deployment Guide (Dokploy, Traefik & Cloudflare)

This application is containerized and pre-configured for seamless automated deployment to **Dokploy** behind a **Traefik** reverse proxy and **Cloudflare** proxy CDN.

### 1. Dokploy Application Setup

1. Open your **Dokploy** dashboard and navigate to **Applications** ➔ **Create Application**.
2. **Provider:** Select **Git** and link your repository branch.
3. **Build Type:** Choose **Dockerfile** or **Docker Compose**.
4. **Port Configuration:** Set internal container port to `3000`.
5. **Environment Variables:** Add the environment variables specified in the section above.

### 2. Persistent Storage (SQLite Database)

To ensure database data persists across deployments and container restarts:

1. In Dokploy, go to your Application's **Volumes** tab.
2. Add a persistent volume:
   - **Volume Name:** `scambaiter_db_data`
   - **Mount Path:** `/app/prisma`

### 3. Automated Cloudflare S3 / R2 Backups

1. In Cloudflare Dashboard, go to **R2 Object Storage** ➔ **Create Bucket** (e.g. `dokploy-backups`).
2. Generate an **R2 API Token** with Read & Write permissions:
   - Access Key ID & Secret Access Key
   - Endpoint: `https://<account_id>.r2.cloudflarestorage.com`
3. In Dokploy, go to **Destinations** ➔ **Create Destination**:
   - Provider: **S3 / Cloudflare R2**
   - Bucket: `dokploy-backups`
   - Set credentials and region (`auto`).
4. In your Application's **Backups** tab:
   - Select volume `scambaiter_db_data`.
   - Set Cron schedule (e.g. `0 3 * * *` for daily backups at 3:00 AM).

### 4. Traefik & Cloudflare Proxy Configuration

1. In Cloudflare DNS, add an `A` or `CNAME` record pointing to your server IP with **Proxy Status: Proxied (Orange Cloud)**.
2. Under Cloudflare **SSL/TLS settings**, select **Full (Strict)**.
3. Traefik will automatically route incoming traffic from port 80/443 to container port `3000` with automated Let's Encrypt TLS certificate generation.

### 5. Database Schema Synchronization

During container startup, `docker-entrypoint.sh` executes `npx prisma db push --skip-generate` automatically. Database updates applied to `prisma/schema.prisma` will be synchronized seamlessly on every container spin-up without data loss.

---

## 💻 Local Development

### Prerequisites

- Node.js (v22+)
- npm or bun

### Setup Steps

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Generate Prisma client & initialize database:
   ```bash
   npm run build
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser.

---

## 📜 License

This project is licensed under the MIT License - see the `license.md` file for details.
