import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function sanitizeDbUrl(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return null;
  let clean = rawInput.trim();
  // Remove surrounding single or double quotes
  clean = clean.replace(/^['"]|['"]$/g, '').trim();
  if (!clean) return null;
  return clean;
}

function isLikelySqliteInput(input) {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) return false;
  // If it starts with http://, https://, postgres://, postgresql://, mysql:// - it's not a SQLite path
  if (/^(https?|postgres(ql)?|mysql):\/\//i.test(trimmed)) return false;
  // If it's a random hex/alphanumeric hash without slashes or dots
  if (/^[a-f0-9]{32,128}$/i.test(trimmed) && !trimmed.includes('/') && !trimmed.includes('.')) return false;
  return true;
}

function resolveDb() {
  console.log('=== [Scambaiter CRM Database Auto-Configurator] ===');
  
  const rawDbCandidate = sanitizeDbUrl(process.env.DB);
  const rawUrlCandidate = sanitizeDbUrl(process.env.DATABASE_URL);

  let chosenInput = null;
  if (isLikelySqliteInput(rawDbCandidate)) {
    chosenInput = rawDbCandidate;
    console.log(`[DB-CONFIG] Using user-specified DB parameter: ${chosenInput}`);
  } else if (isLikelySqliteInput(rawUrlCandidate)) {
    chosenInput = rawUrlCandidate;
    console.log(`[DB-CONFIG] Using user-specified DATABASE_URL parameter: ${chosenInput}`);
  }
  
  let targetFilePath = '';

  if (!chosenInput) {
    // Default to /app/prisma/scambaiter.db if running in Docker container, else ./prisma/scambaiter.db
    const inDocker = fs.existsSync('/app') && (process.cwd() === '/app' || fs.existsSync('/app/package.json'));
    targetFilePath = inDocker
      ? '/app/prisma/scambaiter.db'
      : path.resolve(rootDir, 'prisma/scambaiter.db');
    console.log(`[DB-CONFIG] No valid custom SQLite path provided. Using default path: ${targetFilePath}`);
  } else {
    // Strip file: prefix if user supplied it
    let filePath = chosenInput.startsWith('file:') ? chosenInput.replace(/^file:/, '') : chosenInput;
    // Strip any URL query parameters if present (e.g. ?connection_limit=1)
    filePath = filePath.split('?')[0];

    if (path.isAbsolute(filePath)) {
      targetFilePath = filePath;
    } else {
      targetFilePath = path.resolve(rootDir, filePath);
    }
    console.log(`[DB-CONFIG] Resolved custom SQLite path to absolute path: ${targetFilePath}`);
  }

  // Ensure target directory exists and has read/write permissions
  const targetDir = path.dirname(targetFilePath);
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true, mode: 0o777 });
      console.log(`[DB-CONFIG] Created persistent storage directory: ${targetDir}`);
    }
    // Attempt permission grant for SQLite write access
    try {
      fs.chmodSync(targetDir, 0o777);
    } catch (_) {}

    if (fs.existsSync(targetFilePath)) {
      try {
        fs.chmodSync(targetFilePath, 0o666);
      } catch (_) {}
    }
  } catch (err) {
    console.warn(`[DB-CONFIG] Warning ensuring directory permissions for ${targetDir}:`, err.message);
  }

  // Strictly construct the canonical SQLite URL required by Prisma: file:<absolute_path>
  const canonicalUrl = `file:${targetFilePath}`;
  console.log(`[DB-CONFIG] Canonical Prisma SQLite URL: ${canonicalUrl}`);

  // Set environment variables for current process
  process.env.DATABASE_URL = canonicalUrl;
  process.env.DB = canonicalUrl;

  // Persist / synchronize with .env file in rootDir so child CLI processes (e.g. npx prisma) find it
  try {
    const envPath = path.resolve(rootDir, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Replace or add DATABASE_URL
    if (/^DATABASE_URL=.*$/m.test(envContent)) {
      envContent = envContent.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${canonicalUrl}"`);
    } else {
      envContent += `\nDATABASE_URL="${canonicalUrl}"`;
    }

    // Replace or add DB
    if (/^DB=.*$/m.test(envContent)) {
      envContent = envContent.replace(/^DB=.*$/m, `DB="${canonicalUrl}"`);
    } else {
      envContent += `\nDB="${canonicalUrl}"`;
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
    console.log(`[DB-CONFIG] Updated .env file with validated file: protocol URL.`);

    // Also write a shell sourceable file for entrypoint scripts to export
    const shellEnvPath = path.resolve(rootDir, '.env.db');
    fs.writeFileSync(
      shellEnvPath,
      `export DATABASE_URL="${canonicalUrl}"\nexport DB="${canonicalUrl}"\n`,
      'utf8'
    );
  } catch (envErr) {
    console.warn('[DB-CONFIG] Could not write to .env or .env.db:', envErr.message);
  }

  return { targetFilePath, canonicalUrl };
}

try {
  resolveDb();
} catch (error) {
  console.error('[DB-CONFIG] Fatal error configuring database:', error);
  process.exit(1);
}
