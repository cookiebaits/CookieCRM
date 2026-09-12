import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

// Determine the SQLite database file path
// Dokploy environment settings can specify DB="file:..." or DB="/path/to/users.db" or DATABASE_URL
const defaultDbPath = path.resolve(process.cwd(), 'prisma/scambaiter.db');

const rawDb = process.env.DB?.trim() || process.env.DATABASE_URL?.trim();

let dbUrl: string;

if (!rawDb) {
  dbUrl = `file:${defaultDbPath}`;
} else if (rawDb.startsWith('file:')) {
  const filePath = rawDb.replace(/^file:/, '');
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  dbUrl = `file:${resolved}`;
} else {
  // Plain file path provided in Dokploy (e.g., /app/data/scambaiter.db or ./prisma/scambaiter.db)
  const resolved = path.isAbsolute(rawDb) ? rawDb : path.resolve(process.cwd(), rawDb);
  dbUrl = `file:${resolved}`;
}

// Ensure the directory for the SQLite database file exists
try {
  const actualFilePath = dbUrl.replace(/^file:/, '');
  const targetDir = path.dirname(actualFilePath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
} catch (err) {
  console.warn('[DB] Failed to ensure database directory exists:', err);
}

// Ensure both DB and DATABASE_URL environment variables match for Prisma CLI & runtime
process.env.DATABASE_URL = dbUrl;
process.env.DB = dbUrl;

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

