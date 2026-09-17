import express from 'express';
import { apiRouter } from './routes.ts';
import { seedInitialData } from './seed.ts';

export const backendApp = express();

// Trust multi-hop reverse proxies (Cloudflare Edge -> Dokploy / Traefik reverse proxy)
backendApp.set('trust proxy', true);

// Enable CORS for Dokploy custom domains and Cloudflare proxying
backendApp.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, cf-connecting-ip, x-forwarded-for, x-forwarded-proto');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

backendApp.use(express.json({ limit: '25mb' }));
backendApp.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Mount API router
backendApp.use('/api', apiRouter);

// Initialize seed data on startup
seedInitialData().catch((err) => {
  console.error('Failed to seed initial data:', err);
});
