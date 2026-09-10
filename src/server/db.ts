import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

// Determine the SQLite database file path
const defaultDbPath = path.resolve(process.cwd(), 'prisma/scambaiter.db');

// Ensure parent folder exists
const prismaDir = path.dirname(defaultDbPath);
if (!fs.existsSync(prismaDir)) {
  try {
    fs.mkdirSync(prismaDir, { recursive: true });
  } catch (err) {
    console.warn('Failed to ensure prisma directory:', err);
  }
}

// Normalize DATABASE_URL:
// Prisma with provider = "sqlite" REQUIRES a url starting with "file:"
// If DATABASE_URL is missing, or is a dummy token/hash (not starting with file:),
// or is a raw file path (e.g. ./prisma/scambaiter.db), fix it to "file:..."
let dbUrl = process.env.DATABASE_URL?.trim();

if (!dbUrl || !dbUrl.startsWith('file:')) {
  if (dbUrl && (dbUrl.endsWith('.db') || dbUrl.endsWith('.sqlite') || dbUrl.includes('/') || dbUrl.includes('\\'))) {
    dbUrl = `file:${path.resolve(process.cwd(), dbUrl)}`;
  } else {
    dbUrl = `file:${defaultDbPath}`;
  }
  process.env.DATABASE_URL = dbUrl;
}

// Prevent multiple instances of Prisma Client in development
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  global.prismaGlobal ||
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  global.prismaGlobal = prisma;
}

export default prisma;

