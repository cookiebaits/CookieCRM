import express from 'express';
import { apiRouter } from './routes.ts';
import { seedInitialData } from './seed.ts';

export const backendApp = express();

backendApp.use(express.json({ limit: '25mb' }));
backendApp.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Trust multi-hop reverse proxies (Traefik & Cloudflare Edge)
backendApp.set('trust proxy', true);

// Mount API router
backendApp.use('/api', apiRouter);

// Initialize seed data on startup
seedInitialData().catch((err) => {
  console.error('Failed to seed initial data:', err);
});
