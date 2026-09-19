# Scambaiter Intelligence CRM Tracker

A full-stack CRM and intelligence tracker designed for scambaiters to log calls, manage scammer targets through pipeline stages, track flagged mule accounts, phone numbers, and websites, and analyze monthly time-wasted metrics.

---

## Features

- **Interactive Kanban Pipeline**: Drag and drop scammer targets across canonical stages (`New`, `Qualified`, `Proposition`, `Won`).
- **Call Logs & Audio Recordings**:
  - Click to upload, drag & drop, or paste audio files directly from your clipboard.
  - Automatic audio duration validation limiting clips to less than 1.5 minutes (90 seconds), with exemption for administrator account (`cookiescambait@gmail.com`).
  - Auto-sets call log date to today's date with option to manually pick custom dates.
- **Flagged Mule Accounts / Phone Numbers & Websites**: Track bank routing/account numbers, crypto wallets, Zelle recipients, wire details, phone numbers, and scam websites.
- **Analytics & Reporting**: Track daily, weekly, and monthly baiting hours, top target leaderboards, and estimated victim losses prevented.
- **Admin User Management**: Admin controls for managing registered users and privileges.
- **Google Sign-In**: Integrated Google OAuth identity authentication.

---

## Local Setup & Development

### Prerequisites
- **Node.js**: v20 or higher
- **npm** or **bun**

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

3. Type-checking & Build verification:
   ```bash
   npm run lint
   npm run build
   ```

---

## Deployment Architecture

Built for containerized deployment on **Dokploy** behind a **Cloudflare / Traefik** proxy, or any standard Ubuntu Server running Docker.

### Docker Environment Variables
```env
PORT=3000
NODE_ENV=production
JWT_SECRET=your-secret-key
PRIMARY_ADMIN_EMAIL=cookiescambait@gmail.com
GOOGLE_CLIENT_ID=your-google-client-id
APP_URL=https://your-crm-domain.com
```

### Network Ports
- **Application Port**: `3000` (Internal container & proxy routing)
