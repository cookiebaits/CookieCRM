import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { backendApp } from './src/server/app.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();

// Trust reverse proxies (Traefik & Cloudflare Edge)
app.set('trust proxy', true);

// Direct root healthcheck for Docker / Traefik / Dokploy health monitors
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Use backend API
app.use(backendApp);

// In production, serve static assets built by Vite
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback all unknown GET routes to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.resolve(distPath, 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Scambaiter CRM Server running on http://0.0.0.0:${PORT}`);
});

// Graceful container shutdown for Dokploy & Traefik
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
