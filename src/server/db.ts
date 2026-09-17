import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

function isLikelySqliteInput(input?: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) return false;
  // Exclude remote URLs
  if (/^(https?|postgres(ql)?|mysql):\/\//i.test(trimmed)) return false;
  // Exclude random hex/token strings without slashes or file extension
  if (/^[a-f0-9]{32,128}$/i.test(trimmed) && !trimmed.includes('/') && !trimmed.includes('.')) return false;
  return true;
}

// Determine the SQLite database file path
// Dokploy environment settings can specify DB="file:..." or DB="/path/to/users.db" or DATABASE_URL
const defaultDbPath = path.resolve(process.cwd(), 'prisma/scambaiter.db');

const candidateDb = process.env.DB?.trim();
const candidateUrl = process.env.DATABASE_URL?.trim();

let chosenDb: string | undefined;
if (isLikelySqliteInput(candidateDb)) {
  chosenDb = candidateDb;
} else if (isLikelySqliteInput(candidateUrl)) {
  chosenDb = candidateUrl;
}

let dbUrl: string;

if (!chosenDb) {
  dbUrl = `file:${defaultDbPath}`;
} else if (chosenDb.startsWith('file:')) {
  const filePath = chosenDb.replace(/^file:/, '').split('?')[0];
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  dbUrl = `file:${resolved}`;
} else {
  // Plain file path provided in Dokploy (e.g., /app/data/scambaiter.db or ./prisma/scambaiter.db)
  const cleanPath = chosenDb.split('?')[0];
  const resolved = path.isAbsolute(cleanPath) ? cleanPath : path.resolve(process.cwd(), cleanPath);
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

