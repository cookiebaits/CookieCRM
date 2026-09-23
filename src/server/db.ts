import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';

export interface UserRecord {
  id: string;
  email: string;
  password?: string | null;
  name: string;
  avatarUrl?: string | null;
  googleId?: string | null;
  role: string;
  isActivated?: boolean;
  hasAcceptedTerms?: boolean;
  activationToken?: string | null;
  activationExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    scammers: number;
  };
}

export interface ScammerRecord {
  id: string;
  fullName: string;
  alias?: string | null;
  phoneNumber: string;
  phoneNumbers?: string[];
  whatsappNumber?: string | null;
  status: string;
  carrier?: string | null;
  location?: string | null;
  scamType: string;
  organization?: string | null;
  flagged: boolean;
  dangerLevel: string;
  victimGivenInfo?: string | null;
  remoteAccessId?: string | null;
  ipAddress?: string | null;
  notes?: string | null;
  totalTimeSpent: number;
  targetValue: number;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  userId?: string | null;
  user?: Partial<UserRecord> | null;
  calls?: CallLogRecord[];
  fraudAccounts?: FraudAccountRecord[];
}

export interface CallLogRecord {
  id: string;
  scammerId: string;
  date: Date;
  durationMinutes: number;
  notes?: string | null;
  audioRecordingUrl?: string | null;
  audioRecordingName?: string | null;
  victimPersonaUsed?: string | null;
  infoGiven?: string | null;
  outcome?: string | null;
  createdAt: Date;
  updatedAt: Date;
  scammer?: Partial<ScammerRecord> | null;
}

export interface FraudAccountRecord {
  id: string;
  scammerId: string;
  accountType: string;
  accountDetails: string;
  institution?: string | null;
  holderName?: string | null;
  reportedToBank: boolean;
  createdAt: Date;
}

interface DatabaseState {
  users: UserRecord[];
  scammers: ScammerRecord[];
  callLogs: CallLogRecord[];
  fraudAccounts: FraudAccountRecord[];
}

// -----------------------------------------------------------
// Storage Directory & File Setup (Local Resilient Store)
// -----------------------------------------------------------
const dataDir = process.env.DATA_DIR || (fs.existsSync('/app') ? '/app/data' : path.resolve(process.cwd(), 'data'));

if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o777 });
  } catch (err) {
    console.warn('[DB] Failed to create data directory:', err);
  }
}

const dataFile = path.join(dataDir, 'scambaiter_db.json');

const state: DatabaseState = {
  users: [],
  scammers: [],
  callLogs: [],
  fraudAccounts: [],
};

function loadFromDisk() {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf8');
      const parsed = JSON.parse(raw);

      state.users = (parsed.users || []).map((u: any) => ({
        ...u,
        createdAt: new Date(u.createdAt),
        updatedAt: new Date(u.updatedAt),
      }));

      state.scammers = (parsed.scammers || []).map((s: any) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      }));

      state.callLogs = (parsed.callLogs || []).map((c: any) => ({
        ...c,
        date: new Date(c.date),
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      }));

      state.fraudAccounts = (parsed.fraudAccounts || []).map((f: any) => ({
        ...f,
        createdAt: new Date(f.createdAt),
      }));
    }
  } catch (err) {
    console.warn('[DB] Error loading persistent file:', err);
  }
}

let saveTimeout: NodeJS.Timeout | null = null;
function persistToDisk() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      // Guard against writing an empty state over a non-empty disk backup during boot
      if (
        state.users.length === 0 &&
        state.scammers.length === 0 &&
        state.callLogs.length === 0 &&
        fs.existsSync(dataFile)
      ) {
        try {
          const raw = fs.readFileSync(dataFile, 'utf8');
          const existing = JSON.parse(raw);
          if ((existing.scammers && existing.scammers.length > 0) || (existing.users && existing.users.length > 0)) {
            console.warn('[DB] Skipping persist: preserving non-empty disk cache against boot reset.');
            return;
          }
        } catch {
          // ignore
        }
      }
      fs.writeFileSync(dataFile, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
      console.warn('[DB] Error saving to disk:', err);
    }
  }, 50);
}

loadFromDisk();

// -----------------------------------------------------------
// PostgreSQL Database Connection Setup (Supabase Direct & Pooler)
// -----------------------------------------------------------
export function getDirectPostgresUrl(): string | null {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    process.env.SUPABASE_DATABASE_URL,
    process.env.SUPABASE_DB_URL,
  ];

  for (const c of candidates) {
    if (!c) continue;
    const trimmed = c.trim().replace(/^["']|["']$/g, '');
    if (/^postgres(ql)?:\/\//i.test(trimmed)) {
      return trimmed;
    }
  }

  // Construct from SUPABASE_URL + SUPABASE_DB_PASSWORD if provided
  const supabaseUrl = process.env.SUPABASE_URL || process.env.DB;
  const dbPass = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD;
  if (supabaseUrl && dbPass) {
    const match = supabaseUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
    if (match && match[1]) {
      const projRef = match[1];
      const encodedPass = encodeURIComponent(dbPass);
      const region = process.env.SUPABASE_REGION || 'us-west-2';
      return `postgresql://postgres.${projRef}:${encodedPass}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
    }
  }

  return null;
}

function maskDbUrl(url: string): string {
  try {
    return url.replace(/:\/\/[^:]+:([^@]+)@/, '://***:***@');
  } catch {
    return 'postgresql://***:***@...';
  }
}

let pgPool: pg.Pool | null = null;
let isPostgresReady = false;

let resolveDbReady: (ready: boolean) => void = () => {};
const dbReadyPromise = new Promise<boolean>((resolve) => {
  resolveDbReady = resolve;
});

export async function waitForDatabaseReady(timeoutMs = 8000): Promise<boolean> {
  if (isPostgresReady) return true;
  if (!getDirectPostgresUrl()) return false;
  return Promise.race([
    dbReadyPromise,
    new Promise<boolean>((resolve) => setTimeout(() => resolve(isPostgresReady), timeoutMs)),
  ]);
}

const directConnString = getDirectPostgresUrl();

if (directConnString) {
  const masked = maskDbUrl(directConnString);
  console.log(`[DB-SUPABASE] Detected Supabase PostgreSQL link: ${masked}`);

  const isDisableSsl =
    directConnString.includes('sslmode=disable') ||
    directConnString.includes('@localhost') ||
    directConnString.includes('@127.0.0.1');

  function getFallbackConnStrings(primaryUrl: string): string[] {
    const urls = [primaryUrl];
    // Check if URL matches db.<project-ref>.supabase.co:5432 format
    const match = primaryUrl.match(/postgres(?:ql)?:\/\/(?:([^:]+):([^@]+)@)?db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/([^\?]+)?/i);
    if (match) {
      const pass = match[2] || '';
      const projRef = match[3];
      const dbName = match[4] || 'postgres';
      if (projRef) {
        const candidateRegions = [
          process.env.SUPABASE_REGION || 'us-west-2',
          'us-east-1',
          'eu-central-1',
          'eu-west-1',
          'ap-southeast-1',
        ];
        for (const r of candidateRegions) {
          urls.push(`postgresql://postgres.${projRef}:${pass}@aws-0-${r}.pooler.supabase.com:6543/${dbName}`);
          urls.push(`postgresql://postgres.${projRef}:${pass}@aws-0-${r}.pooler.supabase.com:5432/${dbName}`);
        }
      }
    }
    return Array.from(new Set(urls));
  }

  async function tryConnectPools(candidateUrls: string[], useSsl: boolean) {
    for (const url of candidateUrls) {
      try {
        const testPool = new pg.Pool({
          connectionString: url,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 7000,
          idleTimeoutMillis: 30000,
          max: 15,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
        });

        testPool.on('error', (err) => {
          console.warn('[DB-SUPABASE] Background pool notice (auto-recovered):', err.message);
        });

        const client = await testPool.connect();
        client.release();
        pgPool = testPool;
        isPostgresReady = true;
        console.log(`[DB-SUPABASE] Connected successfully to Supabase PostgreSQL database! (${maskDbUrl(url)})`);

        await initSupabaseDirectSchema();
        await hydrateStateFromPostgres();
        resolveDbReady(true);
        return;
      } catch (err: any) {
        // try next candidate
      }
    }

    if (useSsl) {
      console.log('[DB-SUPABASE] Retrying connection without strict SSL...');
      await tryConnectPools(candidateUrls, false);
    } else {
      console.warn('[DB-SUPABASE] Notice: Operating in resilient local storage mode.');
      resolveDbReady(false);
    }
  }

  const connCandidates = getFallbackConnStrings(directConnString);
  tryConnectPools(connCandidates, !isDisableSsl);
} else {
  console.log('[DB] No direct PostgreSQL connection string detected. Set DATABASE_URL with your Supabase direct postgres link.');
  resolveDbReady(false);
}

async function hydrateStateFromPostgres() {
  if (!pgPool || !isPostgresReady) return;
  try {
    const [uRes, sRes, cRes, fRes] = await Promise.all([
      pgPool.query('SELECT * FROM users ORDER BY created_at ASC'),
      pgPool.query('SELECT * FROM scammers ORDER BY updated_at DESC'),
      pgPool.query('SELECT * FROM call_logs ORDER BY date DESC'),
      pgPool.query('SELECT * FROM fraud_accounts ORDER BY created_at DESC'),
    ]);
    if (uRes.rows.length > 0) state.users = uRes.rows.map(mapUserRow);
    if (sRes.rows.length > 0) state.scammers = sRes.rows.map(mapScammerRow);
    if (cRes.rows.length > 0) state.callLogs = cRes.rows.map(mapCallLogRow);
    if (fRes.rows.length > 0) state.fraudAccounts = fRes.rows.map(mapFraudAccountRow);
    console.log(`[DB-SUPABASE] Cache hydrated from Postgres: ${state.scammers.length} scammers, ${state.callLogs.length} calls, ${state.fraudAccounts.length} fraud accounts.`);
    persistToDisk();
  } catch (err) {
    console.warn('[DB-SUPABASE] Hydration warning:', err);
  }
}

async function initSupabaseDirectSchema() {
  if (!pgPool) return;
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password TEXT,
        name VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        google_id VARCHAR(255) UNIQUE,
        role VARCHAR(50) NOT NULL DEFAULT 'scambaiter',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS scammers (
        id VARCHAR(64) PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        alias VARCHAR(255),
        phone_number VARCHAR(100) NOT NULL,
        status VARCHAR(100) NOT NULL DEFAULT 'New Scammer',
        carrier VARCHAR(255),
        location VARCHAR(255),
        scam_type VARCHAR(100) NOT NULL DEFAULT 'Tech Support',
        organization VARCHAR(255),
        flagged BOOLEAN NOT NULL DEFAULT FALSE,
        danger_level VARCHAR(50) NOT NULL DEFAULT 'medium',
        victim_given_info TEXT,
        remote_access_id VARCHAR(255),
        ip_address VARCHAR(100),
        notes TEXT,
        total_time_spent INT NOT NULL DEFAULT 0,
        target_value INT NOT NULL DEFAULT 0,
        priority INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS call_logs (
        id VARCHAR(64) PRIMARY KEY,
        scammer_id VARCHAR(64) NOT NULL REFERENCES scammers(id) ON DELETE CASCADE,
        date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        duration_minutes INT NOT NULL DEFAULT 0,
        notes TEXT,
        audio_recording_url TEXT,
        audio_recording_name VARCHAR(255),
        victim_persona_used VARCHAR(255),
        info_given TEXT,
        outcome VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS fraud_accounts (
        id VARCHAR(64) PRIMARY KEY,
        scammer_id VARCHAR(64) NOT NULL REFERENCES scammers(id) ON DELETE CASCADE,
        account_type VARCHAR(100) NOT NULL,
        account_details TEXT NOT NULL,
        institution VARCHAR(255),
        holder_name VARCHAR(255),
        reported_to_bank BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_scammers_user_id ON scammers(user_id);
      CREATE INDEX IF NOT EXISTS idx_scammers_status ON scammers(status);
      CREATE INDEX IF NOT EXISTS idx_call_logs_scammer_id ON call_logs(scammer_id);

      -- Ensure activation columns exist on users table
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_activated BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS has_accepted_terms BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_token VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMPTZ;

      -- Ensure all columns on scammers table exist
      ALTER TABLE scammers ADD COLUMN IF NOT EXISTS remote_access_id VARCHAR(255);
      ALTER TABLE scammers ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);
      ALTER TABLE scammers ADD COLUMN IF NOT EXISTS victim_given_info TEXT;
      ALTER TABLE scammers ADD COLUMN IF NOT EXISTS carrier VARCHAR(255);
      ALTER TABLE scammers ADD COLUMN IF NOT EXISTS location VARCHAR(255);
      ALTER TABLE scammers ADD COLUMN IF NOT EXISTS organization VARCHAR(255);
      ALTER TABLE scammers ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
      ALTER TABLE scammers ADD COLUMN IF NOT EXISTS phone_numbers TEXT[];
      ALTER TABLE scammers ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(100);

      -- Ensure all columns on call_logs table exist
      ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS audio_recording_url TEXT;
      ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS audio_recording_name VARCHAR(255);
      ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS victim_persona_used VARCHAR(255);
      ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS info_given TEXT;
      ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS outcome VARCHAR(255);

      -- Ensure all columns on fraud_accounts table exist
      ALTER TABLE fraud_accounts ADD COLUMN IF NOT EXISTS institution VARCHAR(255);
      ALTER TABLE fraud_accounts ADD COLUMN IF NOT EXISTS holder_name VARCHAR(255);
      ALTER TABLE fraud_accounts ADD COLUMN IF NOT EXISTS reported_to_bank BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    console.log('[DB-SUPABASE] Supabase PostgreSQL database tables validated and ready.');
  } catch (err) {
    console.warn('[DB-SUPABASE] Automated table validation warning:', err);
  }
}

// Row mappers
function mapUserRow(row: any): UserRecord {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    name: row.name,
    avatarUrl: row.avatar_url,
    googleId: row.google_id,
    role: row.role,
    isActivated: row.is_activated !== false,
    hasAcceptedTerms: Boolean(row.has_accepted_terms),
    activationToken: row.activation_token || null,
    activationExpiresAt: row.activation_expires_at ? new Date(row.activation_expires_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapScammerRow(row: any): ScammerRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    alias: row.alias,
    phoneNumber: row.phone_number,
    phoneNumbers: Array.isArray(row.phone_numbers)
      ? row.phone_numbers
      : row.phone_numbers
      ? typeof row.phone_numbers === 'string'
        ? JSON.parse(row.phone_numbers)
        : []
      : [],
    whatsappNumber: row.whatsapp_number || null,
    status: row.status,
    carrier: row.carrier,
    location: row.location,
    scamType: row.scam_type,
    organization: row.organization,
    flagged: Boolean(row.flagged),
    dangerLevel: row.danger_level,
    victimGivenInfo: row.victim_given_info,
    remoteAccessId: row.remote_access_id,
    ipAddress: row.ip_address,
    notes: row.notes,
    totalTimeSpent: Number(row.total_time_spent) || 0,
    targetValue: Number(row.target_value) || 0,
    priority: Number(row.priority) || 1,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    userId: row.user_id,
  };
}

function mapCallLogRow(row: any): CallLogRecord {
  return {
    id: row.id,
    scammerId: row.scammer_id,
    date: new Date(row.date),
    durationMinutes: Number(row.duration_minutes) || 0,
    notes: row.notes,
    audioRecordingUrl: row.audio_recording_url,
    audioRecordingName: row.audio_recording_name,
    victimPersonaUsed: row.victim_persona_used,
    infoGiven: row.info_given,
    outcome: row.outcome,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapFraudAccountRow(row: any): FraudAccountRecord {
  return {
    id: row.id,
    scammerId: row.scammer_id,
    accountType: row.account_type,
    accountDetails: row.account_details,
    institution: row.institution,
    holderName: row.holder_name,
    reportedToBank: Boolean(row.reported_to_bank),
    createdAt: new Date(row.created_at),
  };
}

function matchesWhere(item: any, where?: Record<string, any>): boolean {
  if (!where || Object.keys(where).length === 0) return true;

  if (Array.isArray(where.OR)) {
    const orMatches = where.OR.some((cond: any) => matchesWhere(item, cond));
    if (!orMatches) return false;
  }

  for (const [key, expected] of Object.entries(where)) {
    if (key === 'OR') continue;
    const actual = item[key];
    if (expected !== null && typeof expected === 'object') {
      if (Array.isArray(expected.in)) {
        if (!expected.in.includes(actual)) return false;
      }
    } else if (typeof expected === 'string' && typeof actual === 'string' && (key === 'email' || key === 'status')) {
      if (actual.toLowerCase() !== expected.toLowerCase()) return false;
    } else {
      if (actual !== expected) return false;
    }
  }
  return true;
}

function decorateUser(u: UserRecord): UserRecord {
  const scammersCount = state.scammers.filter((s) => s.userId === u.id).length;
  return {
    ...u,
    _count: {
      scammers: scammersCount,
    },
  };
}

// -----------------------------------------------------------
// Database Service Interface (Direct Connection First)
// -----------------------------------------------------------
export const db = {
  isDirectPostgresConnected(): boolean {
    return isPostgresReady;
  },

  user: {
    async findUnique(args: {
      where: { id?: string; email?: string; googleId?: string; activationToken?: string };
      select?: any;
    }): Promise<UserRecord | null> {
      const { id, email, googleId, activationToken } = args.where;

      if (isPostgresReady && pgPool) {
        try {
          let res;
          if (id) {
            res = await pgPool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
          } else if (email) {
            res = await pgPool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
          } else if (googleId) {
            res = await pgPool.query('SELECT * FROM users WHERE google_id = $1 LIMIT 1', [googleId]);
          } else if (activationToken) {
            res = await pgPool.query('SELECT * FROM users WHERE activation_token = $1 LIMIT 1', [activationToken]);
          }
          if (res) {
            if (res.rows[0]) {
              const mapped = mapUserRow(res.rows[0]);
              // update local cache
              const idx = state.users.findIndex((u) => u.id === mapped.id);
              if (idx >= 0) state.users[idx] = mapped; else state.users.push(mapped);
              persistToDisk();
              return decorateUser(mapped);
            }
            return null;
          }
        } catch (err) {
          console.warn('[DB-POSTGRES] findUnique fallback:', err);
        }
      }

      // Local fallback
      const found = state.users.find(
        (u) =>
          (id !== undefined && u.id === id) ||
          (email !== undefined && u.email?.toLowerCase() === email?.toLowerCase()) ||
          (googleId !== undefined && u.googleId === googleId) ||
          (activationToken !== undefined && u.activationToken === activationToken)
      );
      return found ? decorateUser(found) : null;
    },

    async findFirst(args?: { where?: Record<string, any>; select?: any }): Promise<UserRecord | null> {
      if (isPostgresReady && pgPool && args?.where) {
        try {
          if (args.where.activationToken) {
            const res = await pgPool.query('SELECT * FROM users WHERE activation_token = $1 LIMIT 1', [args.where.activationToken]);
            return res.rows[0] ? decorateUser(mapUserRow(res.rows[0])) : null;
          }
          if (args.where.email) {
            const res = await pgPool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [args.where.email]);
            return res.rows[0] ? decorateUser(mapUserRow(res.rows[0])) : null;
          }
          if (args.where.googleId) {
            const res = await pgPool.query('SELECT * FROM users WHERE google_id = $1 LIMIT 1', [args.where.googleId]);
            return res.rows[0] ? decorateUser(mapUserRow(res.rows[0])) : null;
          }
          if (Array.isArray(args.where.OR)) {
            for (const cond of args.where.OR) {
              if (cond.email) {
                const res = await pgPool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [cond.email]);
                if (res.rows[0]) return decorateUser(mapUserRow(res.rows[0]));
              }
              if (cond.googleId) {
                const res = await pgPool.query('SELECT * FROM users WHERE google_id = $1 LIMIT 1', [cond.googleId]);
                if (res.rows[0]) return decorateUser(mapUserRow(res.rows[0]));
              }
              if (cond.activationToken) {
                const res = await pgPool.query('SELECT * FROM users WHERE activation_token = $1 LIMIT 1', [cond.activationToken]);
                if (res.rows[0]) return decorateUser(mapUserRow(res.rows[0]));
              }
            }
            return null;
          }
          if (args.where.role) {
            const res = await pgPool.query('SELECT * FROM users WHERE role = $1 LIMIT 1', [args.where.role]);
            return res.rows[0] ? decorateUser(mapUserRow(res.rows[0])) : null;
          }
        } catch (err) {
          console.warn('[DB-POSTGRES] findFirst fallback:', err);
        }
      }

      const found = state.users.find((u) => matchesWhere(u, args?.where));
      return found ? decorateUser(found) : null;
    },

    async findMany(args?: {
      where?: Record<string, any>;
      select?: any;
      orderBy?: { createdAt?: 'asc' | 'desc' };
    }): Promise<UserRecord[]> {
      if (isPostgresReady && pgPool) {
        try {
          const dir = args?.orderBy?.createdAt === 'asc' ? 'ASC' : 'DESC';
          const res = await pgPool.query(`SELECT * FROM users ORDER BY created_at ${dir}`);
          const mappedList = res.rows.map(mapUserRow);
          state.users = mappedList;
          persistToDisk();
          return mappedList.map(decorateUser);
        } catch (err) {
          console.warn('[DB-POSTGRES] findMany fallback:', err);
        }
      }

      let list = state.users.filter((u) => matchesWhere(u, args?.where));
      if (args?.orderBy?.createdAt === 'asc') {
        list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      } else {
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      return list.map(decorateUser);
    },

    async create(args: {
      data: Partial<UserRecord> & { email: string; name: string };
      select?: any;
    }): Promise<UserRecord> {
      const now = new Date();
      const user: UserRecord = {
        id: args.data.id || crypto.randomUUID(),
        email: args.data.email.toLowerCase().trim(),
        name: args.data.name,
        password: args.data.password || null,
        avatarUrl: args.data.avatarUrl || null,
        googleId: args.data.googleId || null,
        role: args.data.role || 'scambaiter',
        isActivated: args.data.isActivated !== undefined ? args.data.isActivated : true,
        hasAcceptedTerms: Boolean(args.data.hasAcceptedTerms),
        activationToken: args.data.activationToken || null,
        activationExpiresAt: args.data.activationExpiresAt || null,
        createdAt: args.data.createdAt || now,
        updatedAt: args.data.updatedAt || now,
      };

      if (isPostgresReady && pgPool) {
        try {
          const res = await pgPool.query(
            `INSERT INTO users (id, email, password, name, avatar_url, google_id, role, is_activated, has_accepted_terms, activation_token, activation_expires_at, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
             ON CONFLICT (email) DO UPDATE SET 
               name = EXCLUDED.name, 
               password = COALESCE(EXCLUDED.password, users.password), 
               avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url), 
               google_id = COALESCE(EXCLUDED.google_id, users.google_id),
               role = EXCLUDED.role,
               is_activated = EXCLUDED.is_activated,
               has_accepted_terms = EXCLUDED.has_accepted_terms,
               activation_token = EXCLUDED.activation_token,
               activation_expires_at = EXCLUDED.activation_expires_at,
               updated_at = NOW()
             RETURNING *`,
            [
              user.id, user.email, user.password, user.name, user.avatarUrl,
              user.googleId, user.role, user.isActivated, user.hasAcceptedTerms,
              user.activationToken, user.activationExpiresAt, user.createdAt, user.updatedAt
            ]
          );
          if (res.rows[0]) {
            const saved = mapUserRow(res.rows[0]);
            const existingIdx = state.users.findIndex((u) => u.id === saved.id || u.email === saved.email);
            if (existingIdx >= 0) state.users[existingIdx] = saved; else state.users.push(saved);
            persistToDisk();
            return decorateUser(saved);
          }
        } catch (err) {
          console.warn('[DB-SUPABASE] Direct create user fallback:', err);
        }
      }

      const existingIdx = state.users.findIndex((u) => u.email === user.email);
      if (existingIdx >= 0) {
        state.users[existingIdx] = { ...state.users[existingIdx], ...user, updatedAt: now };
        persistToDisk();
        return decorateUser(state.users[existingIdx]);
      }

      state.users.push(user);
      persistToDisk();
      return decorateUser(user);
    },

    async update(args: {
      where: { id?: string; email?: string };
      data: Partial<UserRecord>;
      select?: any;
    }): Promise<UserRecord> {
      let updatedUser: UserRecord | null = null;

      if (isPostgresReady && pgPool) {
        try {
          const sets: string[] = [];
          const values: any[] = [];
          let pIdx = 1;

          if (args.data.name !== undefined) { sets.push(`name = $${pIdx++}`); values.push(args.data.name); }
          if (args.data.password !== undefined) { sets.push(`password = $${pIdx++}`); values.push(args.data.password); }
          if (args.data.avatarUrl !== undefined) { sets.push(`avatar_url = $${pIdx++}`); values.push(args.data.avatarUrl); }
          if (args.data.googleId !== undefined) { sets.push(`google_id = $${pIdx++}`); values.push(args.data.googleId); }
          if (args.data.role !== undefined) { sets.push(`role = $${pIdx++}`); values.push(args.data.role); }
          if (args.data.isActivated !== undefined) { sets.push(`is_activated = $${pIdx++}`); values.push(args.data.isActivated); }
          if (args.data.hasAcceptedTerms !== undefined) { sets.push(`has_accepted_terms = $${pIdx++}`); values.push(args.data.hasAcceptedTerms); }
          if (args.data.activationToken !== undefined) { sets.push(`activation_token = $${pIdx++}`); values.push(args.data.activationToken); }
          if (args.data.activationExpiresAt !== undefined) { sets.push(`activation_expires_at = $${pIdx++}`); values.push(args.data.activationExpiresAt); }
          
          sets.push(`updated_at = NOW()`);

          let whereClause = '';
          if (args.where.id) {
            whereClause = `WHERE id = $${pIdx}`;
            values.push(args.where.id);
          } else if (args.where.email) {
            whereClause = `WHERE LOWER(email) = LOWER($${pIdx})`;
            values.push(args.where.email);
          }

          if (sets.length > 1 && whereClause) {
            const query = `UPDATE users SET ${sets.join(', ')} ${whereClause} RETURNING *`;
            const res = await pgPool.query(query, values);
            if (res.rows[0]) {
              updatedUser = mapUserRow(res.rows[0]);
            }
          }
        } catch (err) {
          console.warn('[DB-POSTGRES] update user fallback:', err);
        }
      }

      const idx = state.users.findIndex(
        (u) =>
          (args.where.id && u.id === args.where.id) ||
          (args.where.email && u.email.toLowerCase() === args.where.email.toLowerCase())
      );

      if (!updatedUser) {
        if (idx === -1) throw new Error('User not found for update');
        updatedUser = {
          ...state.users[idx],
          ...args.data,
          updatedAt: new Date(),
        };
      }

      if (idx >= 0) {
        state.users[idx] = updatedUser;
      } else {
        state.users.push(updatedUser);
      }
      persistToDisk();

      return decorateUser(updatedUser);
    },

    async delete(args: { where: { id: string } }): Promise<UserRecord> {
      let deleted: UserRecord | null = null;
      if (isPostgresReady && pgPool) {
        try {
          const res = await pgPool.query('DELETE FROM users WHERE id = $1 RETURNING *', [args.where.id]);
          if (res.rows[0]) {
            deleted = mapUserRow(res.rows[0]);
          }
        } catch (err) {
          console.warn('[DB-POSTGRES] delete user fallback:', err);
        }
      }

      const idx = state.users.findIndex((u) => u.id === args.where.id);
      if (idx >= 0) {
        const [memDeleted] = state.users.splice(idx, 1);
        if (!deleted) deleted = memDeleted;
      }
      persistToDisk();
      if (!deleted) throw new Error('User not found for deletion');
      return decorateUser(deleted);
    },

    async deleteMany(args?: { where?: Record<string, any> }): Promise<{ count: number }> {
      if (isPostgresReady && pgPool) {
        try {
          if (args?.where?.email?.in) {
            await pgPool.query('DELETE FROM users WHERE email = ANY($1)', [args.where.email.in]);
          } else {
            await pgPool.query('DELETE FROM users');
          }
        } catch (err) {
          console.warn('[DB-POSTGRES] deleteMany users warning:', err);
        }
      }

      const beforeCount = state.users.length;
      if (!args?.where) {
        state.users = [];
      } else {
        state.users = state.users.filter((u) => !matchesWhere(u, args.where));
      }
      persistToDisk();
      return { count: beforeCount - state.users.length };
    },
  },

  scammer: {
    async findMany(args?: {
      where?: Record<string, any>;
      include?: any;
      orderBy?: { updatedAt?: 'asc' | 'desc'; createdAt?: 'asc' | 'desc' };
    }): Promise<ScammerRecord[]> {
      if (isPostgresReady && pgPool) {
        try {
          const dir = args?.orderBy?.createdAt === 'asc' ? 'ASC' : 'DESC';
          const res = await pgPool.query(`SELECT * FROM scammers ORDER BY updated_at ${dir}`);
          const mappedScammers = res.rows.map(mapScammerRow);
          state.scammers = mappedScammers;

          // Keep call logs and fraud accounts synchronized in memory from PostgreSQL
          const [callRes, fraudRes] = await Promise.all([
            pgPool.query('SELECT * FROM call_logs ORDER BY date DESC'),
            pgPool.query('SELECT * FROM fraud_accounts ORDER BY created_at DESC'),
          ]);
          state.callLogs = callRes.rows.map(mapCallLogRow);
          state.fraudAccounts = fraudRes.rows.map(mapFraudAccountRow);
          persistToDisk();
        } catch (err) {
          console.warn('[DB-POSTGRES] findMany scammers fallback:', err);
        }
      }

      let list = state.scammers.filter((s) => matchesWhere(s, args?.where));
      if (args?.orderBy?.createdAt === 'asc') {
        list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      } else if (args?.orderBy?.createdAt === 'desc') {
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      } else {
        list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      }

      return list.map((s) => {
        const item: ScammerRecord = { ...s };
        if (args?.include?.calls) {
          item.calls = state.callLogs
            .filter((c) => c.scammerId === s.id)
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .map((c) => ({ ...c }));
        }
        if (args?.include?.fraudAccounts) {
          item.fraudAccounts = state.fraudAccounts
            .filter((f) => f.scammerId === s.id)
            .map((f) => ({ ...f }));
        }
        if (args?.include?.user && s.userId) {
          const u = state.users.find((u) => u.id === s.userId);
          item.user = u ? { id: u.id, name: u.name, email: u.email } : null;
        }
        return item;
      });
    },

    async findUnique(args: {
      where: { id: string };
      include?: any;
    }): Promise<ScammerRecord | null> {
      if (isPostgresReady && pgPool) {
        try {
          const res = await pgPool.query('SELECT * FROM scammers WHERE id = $1 LIMIT 1', [args.where.id]);
          if (res.rows[0]) {
            const mapped = mapScammerRow(res.rows[0]);
            const item: ScammerRecord = { ...mapped };
            if (args?.include?.calls) {
              const calls = await pgPool.query('SELECT * FROM call_logs WHERE scammer_id = $1 ORDER BY date DESC', [args.where.id]);
              item.calls = calls.rows.map(mapCallLogRow);
            }
            if (args?.include?.fraudAccounts) {
              const fa = await pgPool.query('SELECT * FROM fraud_accounts WHERE scammer_id = $1', [args.where.id]);
              item.fraudAccounts = fa.rows.map(mapFraudAccountRow);
            }
            return item;
          } else {
            return null;
          }
        } catch (err) {
          console.warn('[DB-POSTGRES] findUnique scammer fallback:', err);
        }
      }

      const found = state.scammers.find((s) => s.id === args.where.id);
      if (!found) return null;
      const item: ScammerRecord = { ...found };
      if (args?.include?.calls) {
        item.calls = state.callLogs.filter((c) => c.scammerId === found.id).map((c) => ({ ...c }));
      }
      if (args?.include?.fraudAccounts) {
        item.fraudAccounts = state.fraudAccounts.filter((f) => f.scammerId === found.id).map((f) => ({ ...f }));
      }
      return item;
    },

    async create(args: {
      data: Partial<ScammerRecord> & { fullName: string; phoneNumber: string };
      include?: any;
    }): Promise<ScammerRecord> {
      const now = new Date();
      const scammer: ScammerRecord = {
        id: args.data.id || crypto.randomUUID(),
        fullName: args.data.fullName,
        alias: args.data.alias || null,
        phoneNumber: args.data.phoneNumber,
        phoneNumbers: Array.isArray(args.data.phoneNumbers) ? args.data.phoneNumbers : [args.data.phoneNumber],
        whatsappNumber: args.data.whatsappNumber || null,
        status: args.data.status || 'New Scammer',
        carrier: args.data.carrier || null,
        location: args.data.location || null,
        scamType: args.data.scamType || 'Tech Support',
        organization: args.data.organization || null,
        flagged: args.data.flagged ?? false,
        dangerLevel: args.data.dangerLevel || 'medium',
        victimGivenInfo: args.data.victimGivenInfo || null,
        remoteAccessId: args.data.remoteAccessId || null,
        ipAddress: args.data.ipAddress || null,
        notes: args.data.notes || null,
        totalTimeSpent: args.data.totalTimeSpent || 0,
        targetValue: args.data.targetValue || 0,
        priority: args.data.priority || 1,
        createdAt: args.data.createdAt || now,
        updatedAt: args.data.updatedAt || now,
        userId: args.data.userId || null,
        calls: [],
        fraudAccounts: [],
      };

      if (isPostgresReady && pgPool) {
        try {
          let safeUserId: string | null = scammer.userId || null;
          if (safeUserId) {
            const uCheck = await pgPool.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [safeUserId]);
            if (!uCheck.rows[0]) {
              safeUserId = null;
            }
          }

          await pgPool.query(
            `INSERT INTO scammers (
               id, full_name, alias, phone_number, phone_numbers, whatsapp_number, status, carrier, location,
               scam_type, organization, flagged, danger_level, victim_given_info,
               remote_access_id, ip_address, notes, total_time_spent, target_value,
               priority, created_at, updated_at, user_id
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
             ON CONFLICT (id) DO UPDATE SET
               full_name = EXCLUDED.full_name,
               alias = EXCLUDED.alias,
               phone_number = EXCLUDED.phone_number,
               phone_numbers = EXCLUDED.phone_numbers,
               whatsapp_number = EXCLUDED.whatsapp_number,
               status = EXCLUDED.status,
               carrier = EXCLUDED.carrier,
               location = EXCLUDED.location,
               scam_type = EXCLUDED.scam_type,
               organization = EXCLUDED.organization,
               flagged = EXCLUDED.flagged,
               danger_level = EXCLUDED.danger_level,
               victim_given_info = EXCLUDED.victim_given_info,
               remote_access_id = EXCLUDED.remote_access_id,
               ip_address = EXCLUDED.ip_address,
               notes = EXCLUDED.notes,
               total_time_spent = EXCLUDED.total_time_spent,
               target_value = EXCLUDED.target_value,
               priority = EXCLUDED.priority,
               updated_at = NOW(),
               user_id = EXCLUDED.user_id`,
            [
              scammer.id, scammer.fullName, scammer.alias, scammer.phoneNumber,
              scammer.phoneNumbers, scammer.whatsappNumber, scammer.status,
              scammer.carrier, scammer.location, scammer.scamType, scammer.organization,
              scammer.flagged, scammer.dangerLevel, scammer.victimGivenInfo, scammer.remoteAccessId,
              scammer.ipAddress, scammer.notes, scammer.totalTimeSpent, scammer.targetValue,
              scammer.priority, scammer.createdAt, scammer.updatedAt, safeUserId
            ]
          );
        } catch (err) {
          console.warn('[DB-SUPABASE] create scammer warning:', err);
        }
      }

      state.scammers.push(scammer);
      persistToDisk();
      return { ...scammer };
    },

    async update(args: {
      where: { id: string };
      data: Partial<ScammerRecord>;
      include?: any;
    }): Promise<ScammerRecord> {
      let updated: ScammerRecord | null = null;

      if (isPostgresReady && pgPool) {
        try {
          const res = await pgPool.query(
            `UPDATE scammers SET
               full_name = COALESCE($1, full_name),
               alias = COALESCE($2, alias),
               phone_number = COALESCE($3, phone_number),
               phone_numbers = COALESCE($4, phone_numbers),
               whatsapp_number = COALESCE($5, whatsapp_number),
               status = COALESCE($6, status),
               carrier = COALESCE($7, carrier),
               location = COALESCE($8, location),
               scam_type = COALESCE($9, scam_type),
               organization = COALESCE($10, organization),
               flagged = COALESCE($11, flagged),
               danger_level = COALESCE($12, danger_level),
               victim_given_info = COALESCE($13, victim_given_info),
               remote_access_id = COALESCE($14, remote_access_id),
               ip_address = COALESCE($15, ip_address),
               notes = COALESCE($16, notes),
               total_time_spent = COALESCE($17, total_time_spent),
               target_value = COALESCE($18, target_value),
               priority = COALESCE($19, priority),
               updated_at = NOW()
             WHERE id = $20
             RETURNING *`,
            [
              args.data.fullName, args.data.alias, args.data.phoneNumber,
              args.data.phoneNumbers, args.data.whatsappNumber, args.data.status,
              args.data.carrier, args.data.location, args.data.scamType, args.data.organization,
              args.data.flagged, args.data.dangerLevel, args.data.victimGivenInfo, args.data.remoteAccessId,
              args.data.ipAddress, args.data.notes, args.data.totalTimeSpent, args.data.targetValue,
              args.data.priority, args.where.id
            ]
          );
          if (res.rows[0]) {
            updated = mapScammerRow(res.rows[0]);
          }
        } catch (err) {
          console.warn('[DB-POSTGRES] update scammer warning:', err);
        }
      }

      const idx = state.scammers.findIndex((s) => s.id === args.where.id);
      if (!updated) {
        if (idx === -1) throw new Error('Scammer not found for update');
        const current = state.scammers[idx];
        updated = {
          ...current,
          ...args.data,
          updatedAt: new Date(),
        };
      }

      if (idx >= 0) {
        state.scammers[idx] = updated;
      } else {
        state.scammers.push(updated);
      }
      persistToDisk();

      const res: ScammerRecord = { ...updated };
      if (args.include?.calls) {
        res.calls = state.callLogs.filter((c) => c.scammerId === updated!.id).map((c) => ({ ...c }));
      }
      if (args.include?.fraudAccounts) {
        res.fraudAccounts = state.fraudAccounts.filter((f) => f.scammerId === updated!.id).map((f) => ({ ...f }));
      }
      return res;
    },

    async delete(args: { where: { id: string } }): Promise<ScammerRecord> {
      let deleted: ScammerRecord | null = null;
      if (isPostgresReady && pgPool) {
        try {
          const res = await pgPool.query('DELETE FROM scammers WHERE id = $1 RETURNING *', [args.where.id]);
          if (res.rows[0]) {
            deleted = mapScammerRow(res.rows[0]);
          }
        } catch (err) {
          console.warn('[DB-POSTGRES] delete scammer warning:', err);
        }
      }

      const idx = state.scammers.findIndex((s) => s.id === args.where.id);
      if (idx >= 0) {
        const [memDeleted] = state.scammers.splice(idx, 1);
        if (!deleted) deleted = memDeleted;
      }
      state.callLogs = state.callLogs.filter((c) => c.scammerId !== args.where.id);
      state.fraudAccounts = state.fraudAccounts.filter((f) => f.scammerId !== args.where.id);
      persistToDisk();
      if (!deleted) throw new Error('Scammer not found for deletion');
      return { ...deleted };
    },

    async deleteMany(args?: { where?: Record<string, any> }): Promise<{ count: number }> {
      if (isPostgresReady && pgPool) {
        try {
          if (args?.where?.id?.in) {
            await pgPool.query('DELETE FROM scammers WHERE id = ANY($1)', [args.where.id.in]);
          } else {
            await pgPool.query('DELETE FROM scammers');
          }
        } catch (err) {
          console.warn('[DB-POSTGRES] deleteMany scammers warning:', err);
        }
      }

      const beforeCount = state.scammers.length;
      if (!args?.where) {
        state.scammers = [];
        state.callLogs = [];
        state.fraudAccounts = [];
      } else {
        const toDeleteIds = state.scammers.filter((s) => matchesWhere(s, args.where)).map((s) => s.id);
        state.scammers = state.scammers.filter((s) => !toDeleteIds.includes(s.id));
        state.callLogs = state.callLogs.filter((c) => !toDeleteIds.includes(c.scammerId));
        state.fraudAccounts = state.fraudAccounts.filter((f) => !toDeleteIds.includes(f.scammerId));
      }
      persistToDisk();
      return { count: beforeCount - state.scammers.length };
    },

    async count(args?: { where?: Record<string, any> }): Promise<number> {
      if (isPostgresReady && pgPool && (!args?.where || Object.keys(args.where).length === 0)) {
        try {
          const res = await pgPool.query('SELECT COUNT(*) FROM scammers');
          return parseInt(res.rows[0].count, 10) || 0;
        } catch (err) {
          console.warn('[DB-POSTGRES] count scammers fallback:', err);
        }
      }
      if (!args?.where) return state.scammers.length;
      return state.scammers.filter((s) => matchesWhere(s, args.where)).length;
    },
  },

  callLog: {
    async create(args: {
      data: Partial<CallLogRecord> & { scammerId: string };
      include?: any;
    }): Promise<CallLogRecord> {
      const now = new Date();
      const call: CallLogRecord = {
        id: args.data.id || crypto.randomUUID(),
        scammerId: args.data.scammerId,
        date: args.data.date || now,
        durationMinutes: args.data.durationMinutes || 0,
        notes: args.data.notes || null,
        audioRecordingUrl: args.data.audioRecordingUrl || null,
        audioRecordingName: args.data.audioRecordingName || null,
        victimPersonaUsed: args.data.victimPersonaUsed || null,
        infoGiven: args.data.infoGiven || null,
        outcome: args.data.outcome || null,
        createdAt: args.data.createdAt || now,
        updatedAt: args.data.updatedAt || now,
      };

      if (isPostgresReady && pgPool) {
        try {
          await pgPool.query(
            `INSERT INTO call_logs (
               id, scammer_id, date, duration_minutes, notes,
               audio_recording_url, audio_recording_name, victim_persona_used,
               info_given, outcome, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE SET
               date = EXCLUDED.date,
               duration_minutes = EXCLUDED.duration_minutes,
               notes = EXCLUDED.notes,
               audio_recording_url = EXCLUDED.audio_recording_url,
               audio_recording_name = EXCLUDED.audio_recording_name,
               victim_persona_used = EXCLUDED.victim_persona_used,
               info_given = EXCLUDED.info_given,
               outcome = EXCLUDED.outcome,
               updated_at = NOW()`,
            [
              call.id, call.scammerId, call.date, call.durationMinutes, call.notes,
              call.audioRecordingUrl, call.audioRecordingName, call.victimPersonaUsed,
              call.infoGiven, call.outcome, call.createdAt, call.updatedAt
            ]
          );
        } catch (err) {
          console.warn('[DB-SUPABASE] create call_log warning:', err);
        }
      }

      state.callLogs.push(call);
      persistToDisk();
      return { ...call };
    },

    async findMany(args?: {
      where?: { scammerId?: string | { in?: string[] } };
      include?: any;
      orderBy?: { date?: 'asc' | 'desc' };
    }): Promise<CallLogRecord[]> {
      if (isPostgresReady && pgPool) {
        try {
          const dir = args?.orderBy?.date === 'asc' ? 'ASC' : 'DESC';
          let res;
          if (args?.where?.scammerId) {
            if (typeof args.where.scammerId === 'string') {
              res = await pgPool.query(`SELECT * FROM call_logs WHERE scammer_id = $1 ORDER BY date ${dir}`, [args.where.scammerId]);
            } else if (args.where.scammerId?.in) {
              res = await pgPool.query(`SELECT * FROM call_logs WHERE scammer_id = ANY($1::varchar[]) ORDER BY date ${dir}`, [args.where.scammerId.in]);
            } else {
              res = await pgPool.query(`SELECT * FROM call_logs ORDER BY date ${dir}`);
            }
          } else {
            res = await pgPool.query(`SELECT * FROM call_logs ORDER BY date ${dir}`);
          }
          const mapped = res.rows.map(mapCallLogRow);
          if (args?.include?.scammer) {
            const scammersRes = await pgPool.query('SELECT id, full_name, alias FROM scammers');
            const scammerMap = new Map(scammersRes.rows.map((s) => [s.id, { fullName: s.full_name, alias: s.alias }]));
            mapped.forEach((c) => {
              c.scammer = scammerMap.get(c.scammerId) || null;
            });
          }
          return mapped;
        } catch (err) {
          console.warn('[DB-POSTGRES] findMany call_logs fallback:', err);
        }
      }

      let list = state.callLogs.filter((c) => matchesWhere(c, args?.where));
      if (args?.orderBy?.date === 'asc') {
        list.sort((a, b) => a.date.getTime() - b.date.getTime());
      } else {
        list.sort((a, b) => b.date.getTime() - a.date.getTime());
      }
      return list.map((c) => {
        const item: CallLogRecord = { ...c };
        if (args?.include?.scammer) {
          const s = state.scammers.find((s) => s.id === c.scammerId);
          item.scammer = s ? { fullName: s.fullName, alias: s.alias } : null;
        }
        return item;
      });
    },

    async update(args: {
      where: { id: string };
      data: Partial<CallLogRecord>;
      include?: any;
    }): Promise<CallLogRecord> {
      let updated: CallLogRecord | null = null;

      if (isPostgresReady && pgPool) {
        try {
          const res = await pgPool.query(
            `UPDATE call_logs SET
               duration_minutes = COALESCE($1, duration_minutes),
               notes = COALESCE($2, notes),
               audio_recording_url = COALESCE($3, audio_recording_url),
               audio_recording_name = COALESCE($4, audio_recording_name),
               victim_persona_used = COALESCE($5, victim_persona_used),
               info_given = COALESCE($6, info_given),
               outcome = COALESCE($7, outcome),
               updated_at = NOW()
             WHERE id = $8
             RETURNING *`,
            [
              args.data.durationMinutes, args.data.notes, args.data.audioRecordingUrl,
              args.data.audioRecordingName, args.data.victimPersonaUsed, args.data.infoGiven,
              args.data.outcome, args.where.id
            ]
          );
          if (res.rows[0]) {
            updated = mapCallLogRow(res.rows[0]);
          }
        } catch (err) {
          console.warn('[DB-POSTGRES] update call_log warning:', err);
        }
      }

      const idx = state.callLogs.findIndex((c) => c.id === args.where.id);
      if (!updated) {
        if (idx === -1) throw new Error('Call log not found for update');
        const current = state.callLogs[idx];
        updated = {
          ...current,
          ...args.data,
          updatedAt: new Date(),
        };
      }

      if (idx >= 0) {
        state.callLogs[idx] = updated;
      } else {
        state.callLogs.push(updated);
      }
      persistToDisk();
      return { ...updated };
    },

    async delete(args: { where: { id: string } }): Promise<CallLogRecord> {
      let deleted: CallLogRecord | null = null;
      if (isPostgresReady && pgPool) {
        try {
          const res = await pgPool.query('DELETE FROM call_logs WHERE id = $1 RETURNING *', [args.where.id]);
          if (res.rows[0]) {
            deleted = mapCallLogRow(res.rows[0]);
          }
        } catch (err) {
          console.warn('[DB-POSTGRES] delete call_log warning:', err);
        }
      }

      const idx = state.callLogs.findIndex((c) => c.id === args.where.id);
      if (idx >= 0) {
        const [memDeleted] = state.callLogs.splice(idx, 1);
        if (!deleted) deleted = memDeleted;
      }
      persistToDisk();
      if (!deleted) throw new Error('Call log not found for deletion');
      return { ...deleted };
    },

    async deleteMany(args?: { where?: Record<string, any> }): Promise<{ count: number }> {
      if (isPostgresReady && pgPool) {
        try {
          await pgPool.query('DELETE FROM call_logs');
        } catch (err) {
          console.warn('[DB-POSTGRES] deleteMany call_logs warning:', err);
        }
      }

      const beforeCount = state.callLogs.length;
      if (!args?.where) {
        state.callLogs = [];
      } else {
        state.callLogs = state.callLogs.filter((c) => !matchesWhere(c, args.where));
      }
      persistToDisk();
      return { count: beforeCount - state.callLogs.length };
    },

    async count(): Promise<number> {
      if (isPostgresReady && pgPool) {
        try {
          const res = await pgPool.query('SELECT COUNT(*) FROM call_logs');
          return parseInt(res.rows[0].count, 10) || 0;
        } catch (err) {
          console.warn('[DB-POSTGRES] count call_logs fallback:', err);
        }
      }
      return state.callLogs.length;
    },

    async aggregate(args: { _sum: { durationMinutes: boolean } }): Promise<{ _sum: { durationMinutes: number } }> {
      if (isPostgresReady && pgPool) {
        try {
          const res = await pgPool.query('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM call_logs');
          return { _sum: { durationMinutes: parseInt(res.rows[0].total, 10) || 0 } };
        } catch (err) {
          console.warn('[DB-POSTGRES] aggregate call_logs fallback:', err);
        }
      }
      const sum = state.callLogs.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);
      return { _sum: { durationMinutes: sum } };
    },
  },

  fraudAccount: {
    async create(args: {
      data: Partial<FraudAccountRecord> & { scammerId: string; accountType: string; accountDetails: string };
      include?: any;
    }): Promise<FraudAccountRecord> {
      const account: FraudAccountRecord = {
        id: args.data.id || crypto.randomUUID(),
        scammerId: args.data.scammerId,
        accountType: args.data.accountType,
        accountDetails: args.data.accountDetails,
        institution: args.data.institution || null,
        holderName: args.data.holderName || null,
        reportedToBank: args.data.reportedToBank ?? false,
        createdAt: args.data.createdAt || new Date(),
      };

      if (isPostgresReady && pgPool) {
        try {
          await pgPool.query(
            `INSERT INTO fraud_accounts (
               id, scammer_id, account_type, account_details, institution, holder_name, reported_to_bank, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
               account_type = EXCLUDED.account_type,
               account_details = EXCLUDED.account_details,
               institution = EXCLUDED.institution,
               holder_name = EXCLUDED.holder_name,
               reported_to_bank = EXCLUDED.reported_to_bank`,
            [
              account.id, account.scammerId, account.accountType, account.accountDetails,
              account.institution, account.holderName, account.reportedToBank, account.createdAt
            ]
          );
        } catch (err) {
          console.warn('[DB-SUPABASE] create fraud_account warning:', err);
        }
      }

      state.fraudAccounts.push(account);
      persistToDisk();
      return { ...account };
    },

    async delete(args: { where: { id: string } }): Promise<FraudAccountRecord> {
      let deleted: FraudAccountRecord | null = null;
      if (isPostgresReady && pgPool) {
        try {
          const res = await pgPool.query('DELETE FROM fraud_accounts WHERE id = $1 RETURNING *', [args.where.id]);
          if (res.rows[0]) {
            deleted = mapFraudAccountRow(res.rows[0]);
          }
        } catch (err) {
          console.warn('[DB-POSTGRES] delete fraud_account warning:', err);
        }
      }

      const idx = state.fraudAccounts.findIndex((f) => f.id === args.where.id);
      if (idx >= 0) {
        const [memDeleted] = state.fraudAccounts.splice(idx, 1);
        if (!deleted) deleted = memDeleted;
      }
      persistToDisk();
      if (!deleted) throw new Error('Fraud account not found for deletion');
      return { ...deleted };
    },

    async deleteMany(args?: { where?: Record<string, any> }): Promise<{ count: number }> {
      if (isPostgresReady && pgPool) {
        try {
          await pgPool.query('DELETE FROM fraud_accounts');
        } catch (err) {
          console.warn('[DB-POSTGRES] deleteMany fraud_accounts warning:', err);
        }
      }

      const beforeCount = state.fraudAccounts.length;
      if (!args?.where) {
        state.fraudAccounts = [];
      } else {
        state.fraudAccounts = state.fraudAccounts.filter((f) => !matchesWhere(f, args.where));
      }
      persistToDisk();
      return { count: beforeCount - state.fraudAccounts.length };
    },
  },
};

export async function clearAllPrefilledData() {
  if (isPostgresReady && pgPool) {
    try {
      await pgPool.query('DELETE FROM call_logs');
      await pgPool.query('DELETE FROM fraud_accounts');
      await pgPool.query('DELETE FROM scammers');
      console.log('[DB] Cleared all prefilled scammers, calls, and fraud records from PostgreSQL.');
    } catch (err) {
      console.warn('[DB] Warning clearing postgres prefilled data:', err);
    }
  }
  state.scammers = [];
  state.callLogs = [];
  state.fraudAccounts = [];
  persistToDisk();
  console.log('[DB] Cleared all prefilled data from local store.');
}

export default db;
