import express from 'express';
import { apiRouter } from './routes.ts';
import { seedInitialData } from './seed.ts';

export const backendApp = express();

backendApp.use(express.json({ limit: '25mb' }));
backendApp.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Trust reverse proxies (Traefik / Cloudflare)
backendApp.set('trust proxy', 1);

// Mount API router
backendApp.use('/api', apiRouter);

// Initialize seed data on startup
seedInitialData().catch((err) => {
  console.error('Failed to seed initial data:', err);
});
