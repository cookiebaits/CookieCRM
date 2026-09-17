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
      fs.writeFileSync(dataFile, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
      console.warn('[DB] Error saving to disk:', err);
    }
  }, 50);
}

loadFromDisk();

// -----------------------------------------------------------
// Supabase Direct PostgreSQL Connection Setup
// -----------------------------------------------------------
export function getDirectPostgresUrl(): string | null {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    process.env.SUPABASE_DB_URL,
    process.env.SUPABASE_DATABASE_URL,
    process.env.DB,
  ];

  for (const c of candidates) {
    if (!c) continue;
    const trimmed = c.trim();
    if (/^postgres(ql)?:\/\//i.test(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

let pgPool: pg.Pool | null = null;
let isPostgresReady = false;

const directConnString = getDirectPostgresUrl();

if (directConnString) {
  try {
    pgPool = new pg.Pool({
      connectionString: directConnString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
      max: 10,
    });

    // Verify connection and auto-create schema
    pgPool.connect((err, client, release) => {
      if (err) {
        console.warn(`[DB-POSTGRES] Notice: Could not connect to direct PostgreSQL connection (${err.message}). Using resilient local storage.`);
      } else {
        release();
        isPostgresReady = true;
        console.log('[DB-POSTGRES] Connected to Supabase via direct connection string!');
        initSupabaseDirectSchema();
      }
    });
  } catch (err) {
    console.warn('[DB-POSTGRES] Pool initialization warning:', err);
  }
} else {
  console.log('[DB] No direct PostgreSQL connection string detected (e.g. postgresql://...). Operating in local resilient mode.');
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
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE
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
    `);
    console.log('[DB-POSTGRES] Supabase PostgreSQL database tables validated and ready.');
  } catch (err) {
    console.warn('[DB-POSTGRES] Automated table validation warning:', err);
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
  for (const [key, expected] of Object.entries(where)) {
    const actual = item[key];
    if (expected !== null && typeof expected === 'object') {
      if (Array.isArray(expected.in)) {
        if (!expected.in.includes(actual)) return false;
      }
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
      where: { id?: string; email?: string; googleId?: string };
      select?: any;
    }): Promise<UserRecord | null> {
      const { id, email, googleId } = args.where;
      if (isPostgresReady && pgPool) {
        try {
          let res;
          if (id) {
            res = await pgPool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
          } else if (email) {
            res = await pgPool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
          } else if (googleId) {
            res = await pgPool.query('SELECT * FROM users WHERE google_id = $1 LIMIT 1', [googleId]);
          }
          if (res && res.rows[0]) {
            const mapped = mapUserRow(res.rows[0]);
            // update local cache
            const idx = state.users.findIndex((u) => u.id === mapped.id);
            if (idx >= 0) state.users[idx] = mapped; else state.users.push(mapped);
            persistToDisk();
            return decorateUser(mapped);
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
          (googleId !== undefined && u.googleId === googleId)
      );
      return found ? decorateUser(found) : null;
    },

    async findFirst(args?: { where?: Record<string, any>; select?: any }): Promise<UserRecord | null> {
      if (isPostgresReady && pgPool && args?.where) {
        try {
          if (args.where.role) {
            const res = await pgPool.query('SELECT * FROM users WHERE role = $1 LIMIT 1', [args.where.role]);
            if (res.rows[0]) return decorateUser(mapUserRow(res.rows[0]));
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
        createdAt: args.data.createdAt || now,
        updatedAt: args.data.updatedAt || now,
      };

      if (isPostgresReady && pgPool) {
        try {
          await pgPool.query(
            `INSERT INTO users (id, email, password, name, avatar_url, google_id, role, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET
               email = EXCLUDED.email,
               name = EXCLUDED.name,
               password = EXCLUDED.password,
               avatar_url = EXCLUDED.avatar_url,
               role = EXCLUDED.role,
               updated_at = NOW()`,
            [user.id, user.email, user.password, user.name, user.avatarUrl, user.googleId, user.role, user.createdAt, user.updatedAt]
          );
        } catch (err) {
          console.warn('[DB-POSTGRES] create user warning:', err);
        }
      }

      const idx = state.users.findIndex((u) => u.id === user.id);
      if (idx >= 0) state.users[idx] = user; else state.users.push(user);
      persistToDisk();
      return decorateUser(user);
    },

    async update(args: {
      where: { id?: string; email?: string };
      data: Partial<UserRecord>;
      select?: any;
    }): Promise<UserRecord> {
      const idx = state.users.findIndex(
        (u) =>
          (args.where.id !== undefined && u.id === args.where.id) ||
          (args.where.email !== undefined && u.email?.toLowerCase() === args.where.email?.toLowerCase())
      );
      const current = idx >= 0 ? state.users[idx] : null;
      const updated: UserRecord = {
        ...(current || { id: args.where.id || crypto.randomUUID(), email: args.where.email || '', name: 'Admin', role: 'admin', createdAt: new Date() }),
        ...args.data,
        updatedAt: new Date(),
      };

      if (isPostgresReady && pgPool) {
        try {
          if (args.where.id) {
            await pgPool.query(
              `UPDATE users SET
                 email = COALESCE($1, email),
                 name = COALESCE($2, name),
                 password = COALESCE($3, password),
                 role = COALESCE($4, role),
                 avatar_url = COALESCE($5, avatar_url),
                 updated_at = NOW()
               WHERE id = $6`,
              [updated.email, updated.name, updated.password, updated.role, updated.avatarUrl, args.where.id]
            );
          } else if (args.where.email) {
            await pgPool.query(
              `UPDATE users SET
                 name = COALESCE($1, name),
                 password = COALESCE($2, password),
                 role = COALESCE($3, role),
                 avatar_url = COALESCE($4, avatar_url),
                 updated_at = NOW()
               WHERE LOWER(email) = LOWER($5)`,
              [updated.name, updated.password, updated.role, updated.avatarUrl, args.where.email]
            );
          }
        } catch (err) {
          console.warn('[DB-POSTGRES] update user warning:', err);
        }
      }

      if (idx >= 0) {
        state.users[idx] = updated;
      } else {
        state.users.push(updated);
      }
      persistToDisk();
      return decorateUser(updated);
    },

    async delete(args: { where: { id: string } }): Promise<UserRecord> {
      if (isPostgresReady && pgPool) {
        try {
          await pgPool.query('DELETE FROM users WHERE id = $1', [args.where.id]);
        } catch (err) {
          console.warn('[DB-POSTGRES] delete user warning:', err);
        }
      }

      const idx = state.users.findIndex((u) => u.id === args.where.id);
      if (idx === -1) {
        return decorateUser({ id: args.where.id, email: '', name: '', role: 'scambaiter', createdAt: new Date(), updatedAt: new Date() });
      }
      const [deleted] = state.users.splice(idx, 1);
      persistToDisk();
      return decorateUser(deleted);
    },

    async deleteMany(args?: { where?: Record<string, any> }): Promise<{ count: number }> {
      let count = 0;
      if (isPostgresReady && pgPool && args?.where?.email?.in) {
        try {
          const res = await pgPool.query('DELETE FROM users WHERE email = ANY($1)', [args.where.email.in]);
          count = res.rowCount || 0;
        } catch (err) {
          console.warn('[DB-POSTGRES] deleteMany users warning:', err);
        }
      }

      const remaining: UserRecord[] = [];
      for (const u of state.users) {
        if (matchesWhere(u, args?.where)) {
          count++;
        } else {
          remaining.push(u);
        }
      }
      state.users = remaining;
      persistToDisk();
      return { count };
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

          // Fetch calls and fraud accounts in parallel
          if (args?.include?.calls || args?.include?.fraudAccounts) {
            const [callRes, fraudRes] = await Promise.all([
              pgPool.query('SELECT * FROM call_logs ORDER BY date DESC'),
              pgPool.query('SELECT * FROM fraud_accounts ORDER BY created_at DESC'),
            ]);
            state.callLogs = callRes.rows.map(mapCallLogRow);
            state.fraudAccounts = fraudRes.rows.map(mapFraudAccountRow);
          }
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
          await pgPool.query(
            `INSERT INTO scammers (
               id, full_name, alias, phone_number, status, carrier, location,
               scam_type, organization, flagged, danger_level, victim_given_info,
               remote_access_id, ip_address, notes, total_time_spent, target_value,
               priority, created_at, updated_at, user_id
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
            [
              scammer.id, scammer.fullName, scammer.alias, scammer.phoneNumber, scammer.status,
              scammer.carrier, scammer.location, scammer.scamType, scammer.organization,
              scammer.flagged, scammer.dangerLevel, scammer.victimGivenInfo, scammer.remoteAccessId,
              scammer.ipAddress, scammer.notes, scammer.totalTimeSpent, scammer.targetValue,
              scammer.priority, scammer.createdAt, scammer.updatedAt, scammer.userId
            ]
          );
        } catch (err) {
          console.warn('[DB-POSTGRES] create scammer warning:', err);
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
      const idx = state.scammers.findIndex((s) => s.id === args.where.id);
      if (idx === -1) throw new Error('Scammer not found for update');
      const current = state.scammers[idx];
      const updated: ScammerRecord = {
        ...current,
        ...args.data,
        updatedAt: new Date(),
      };

      if (isPostgresReady && pgPool) {
        try {
          await pgPool.query(
            `UPDATE scammers SET
               full_name = COALESCE($1, full_name),
               alias = COALESCE($2, alias),
               phone_number = COALESCE($3, phone_number),
               status = COALESCE($4, status),
               carrier = COALESCE($5, carrier),
               location = COALESCE($6, location),
               scam_type = COALESCE($7, scam_type),
               organization = COALESCE($8, organization),
               flagged = COALESCE($9, flagged),
               danger_level = COALESCE($10, danger_level),
               victim_given_info = COALESCE($11, victim_given_info),
               remote_access_id = COALESCE($12, remote_access_id),
               ip_address = COALESCE($13, ip_address),
               notes = COALESCE($14, notes),
               total_time_spent = COALESCE($15, total_time_spent),
               target_value = COALESCE($16, target_value),
               priority = COALESCE($17, priority),
               updated_at = NOW()
             WHERE id = $18`,
            [
              updated.fullName, updated.alias, updated.phoneNumber, updated.status,
              updated.carrier, updated.location, updated.scamType, updated.organization,
              updated.flagged, updated.dangerLevel, updated.victimGivenInfo, updated.remoteAccessId,
              updated.ipAddress, updated.notes, updated.totalTimeSpent, updated.targetValue,
              updated.priority, updated.id
            ]
          );
        } catch (err) {
          console.warn('[DB-POSTGRES] update scammer warning:', err);
        }
      }

      state.scammers[idx] = updated;
      persistToDisk();

      const res: ScammerRecord = { ...updated };
      if (args.include?.calls) {
        res.calls = state.callLogs.filter((c) => c.scammerId === updated.id).map((c) => ({ ...c }));
      }
      if (args.include?.fraudAccounts) {
        res.fraudAccounts = state.fraudAccounts.filter((f) => f.scammerId === updated.id).map((f) => ({ ...f }));
      }
      return res;
    },

    async delete(args: { where: { id: string } }): Promise<ScammerRecord> {
      if (isPostgresReady && pgPool) {
        try {
          await pgPool.query('DELETE FROM scammers WHERE id = $1', [args.where.id]);
        } catch (err) {
          console.warn('[DB-POSTGRES] delete scammer warning:', err);
        }
      }

      const idx = state.scammers.findIndex((s) => s.id === args.where.id);
      if (idx === -1) throw new Error('Scammer not found for deletion');
      const [deleted] = state.scammers.splice(idx, 1);
      state.callLogs = state.callLogs.filter((c) => c.scammerId !== args.where.id);
      state.fraudAccounts = state.fraudAccounts.filter((f) => f.scammerId !== args.where.id);
      persistToDisk();
      return { ...deleted };
    },

    async count(args?: { where?: Record<string, any> }): Promise<number> {
      if (isPostgresReady && pgPool) {
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
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              call.id, call.scammerId, call.date, call.durationMinutes, call.notes,
              call.audioRecordingUrl, call.audioRecordingName, call.victimPersonaUsed,
              call.infoGiven, call.outcome, call.createdAt, call.updatedAt
            ]
          );
        } catch (err) {
          console.warn('[DB-POSTGRES] create call_log warning:', err);
        }
      }

      state.callLogs.push(call);
      persistToDisk();
      return { ...call };
    },

    async findMany(args?: {
      where?: { scammerId?: string };
      include?: any;
      orderBy?: { date?: 'asc' | 'desc' };
    }): Promise<CallLogRecord[]> {
      if (isPostgresReady && pgPool) {
        try {
          const dir = args?.orderBy?.date === 'asc' ? 'ASC' : 'DESC';
          let res;
          if (args?.where?.scammerId) {
            res = await pgPool.query(`SELECT * FROM call_logs WHERE scammer_id = $1 ORDER BY date ${dir}`, [args.where.scammerId]);
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
      const idx = state.callLogs.findIndex((c) => c.id === args.where.id);
      if (idx === -1) throw new Error('Call log not found for update');
      const current = state.callLogs[idx];
      const updated: CallLogRecord = {
        ...current,
        ...args.data,
        updatedAt: new Date(),
      };

      if (isPostgresReady && pgPool) {
        try {
          await pgPool.query(
            `UPDATE call_logs SET
               duration_minutes = COALESCE($1, duration_minutes),
               notes = COALESCE($2, notes),
               audio_recording_url = COALESCE($3, audio_recording_url),
               audio_recording_name = COALESCE($4, audio_recording_name),
               victim_persona_used = COALESCE($5, victim_persona_used),
               info_given = COALESCE($6, info_given),
               outcome = COALESCE($7, outcome),
               updated_at = NOW()
             WHERE id = $8`,
            [
              updated.durationMinutes, updated.notes, updated.audioRecordingUrl,
              updated.audioRecordingName, updated.victimPersonaUsed, updated.infoGiven,
              updated.outcome, updated.id
            ]
          );
        } catch (err) {
          console.warn('[DB-POSTGRES] update call_log warning:', err);
        }
      }

      state.callLogs[idx] = updated;
      persistToDisk();
      return { ...updated };
    },

    async delete(args: { where: { id: string } }): Promise<CallLogRecord> {
      if (isPostgresReady && pgPool) {
        try {
          await pgPool.query('DELETE FROM call_logs WHERE id = $1', [args.where.id]);
        } catch (err) {
          console.warn('[DB-POSTGRES] delete call_log warning:', err);
        }
      }

      const idx = state.callLogs.findIndex((c) => c.id === args.where.id);
      if (idx === -1) throw new Error('Call log not found for deletion');
      const [deleted] = state.callLogs.splice(idx, 1);
      persistToDisk();
      return { ...deleted };
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
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              account.id, account.scammerId, account.accountType, account.accountDetails,
              account.institution, account.holderName, account.reportedToBank, account.createdAt
            ]
          );
        } catch (err) {
          console.warn('[DB-POSTGRES] create fraud_account warning:', err);
        }
      }

      state.fraudAccounts.push(account);
      persistToDisk();
      return { ...account };
    },

    async delete(args: { where: { id: string } }): Promise<FraudAccountRecord> {
      if (isPostgresReady && pgPool) {
        try {
          await pgPool.query('DELETE FROM fraud_accounts WHERE id = $1', [args.where.id]);
        } catch (err) {
          console.warn('[DB-POSTGRES] delete fraud_account warning:', err);
        }
      }

      const idx = state.fraudAccounts.findIndex((f) => f.id === args.where.id);
      if (idx === -1) throw new Error('Fraud account not found for deletion');
      const [deleted] = state.fraudAccounts.splice(idx, 1);
      persistToDisk();
      return { ...deleted };
    },
  },
};

export const prisma = db;
export default db;
