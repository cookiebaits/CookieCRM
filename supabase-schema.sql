-- =========================================================
-- Scambaiter CRM - Supabase PostgreSQL Schema & Setup Script
-- =========================================================
-- Instructions for Supabase SQL Editor:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard).
-- 2. Select your project (e.g. fanivhbjwfaiezpsawpa).
-- 3. Click on "SQL Editor" in the left sidebar menu.
-- 4. Click "New Query".
-- 5. Copy and paste the entire content of this script into the editor.
-- 6. Click "Run" (or press Ctrl+Enter / Cmd+Enter).

-- ---------------------------------------------------------
-- 1. Users Table
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  name TEXT NOT NULL,
  avatar_url TEXT,
  google_id TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'scambaiter',
  is_activated BOOLEAN NOT NULL DEFAULT TRUE,
  has_accepted_terms BOOLEAN NOT NULL DEFAULT FALSE,
  activation_token TEXT,
  activation_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assert all columns exist if table already existed
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_activated BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_accepted_terms BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMPTZ;

-- ---------------------------------------------------------
-- 2. Scammers Table
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS scammers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  alias TEXT,
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New Scammer',
  carrier TEXT,
  location TEXT,
  scam_type TEXT NOT NULL DEFAULT 'Tech Support',
  organization TEXT,
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  danger_level TEXT NOT NULL DEFAULT 'medium',
  victim_given_info TEXT,
  remote_access_id TEXT,
  ip_address TEXT,
  notes TEXT,
  total_time_spent INT NOT NULL DEFAULT 0,
  target_value INT NOT NULL DEFAULT 0,
  priority INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- Assert all columns exist if table already existed
ALTER TABLE scammers ADD COLUMN IF NOT EXISTS remote_access_id TEXT;
ALTER TABLE scammers ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE scammers ADD COLUMN IF NOT EXISTS victim_given_info TEXT;
ALTER TABLE scammers ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE scammers ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE scammers ADD COLUMN IF NOT EXISTS organization TEXT;
ALTER TABLE scammers ADD COLUMN IF NOT EXISTS user_id TEXT;

-- ---------------------------------------------------------
-- 3. Call Logs Table
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_logs (
  id TEXT PRIMARY KEY,
  scammer_id TEXT NOT NULL REFERENCES scammers(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_minutes INT NOT NULL DEFAULT 0,
  notes TEXT,
  audio_recording_url TEXT,
  audio_recording_name TEXT,
  victim_persona_used TEXT,
  info_given TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assert all columns exist if table already existed
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS audio_recording_url TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS audio_recording_name TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS victim_persona_used TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS info_given TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS outcome TEXT;

-- ---------------------------------------------------------
-- 4. Fraud Accounts / Mules Table
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS fraud_accounts (
  id TEXT PRIMARY KEY,
  scammer_id TEXT NOT NULL REFERENCES scammers(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL,
  account_details TEXT NOT NULL,
  institution TEXT,
  holder_name TEXT,
  reported_to_bank BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assert all columns exist if table already existed
ALTER TABLE fraud_accounts ADD COLUMN IF NOT EXISTS institution TEXT;
ALTER TABLE fraud_accounts ADD COLUMN IF NOT EXISTS holder_name TEXT;
ALTER TABLE fraud_accounts ADD COLUMN IF NOT EXISTS reported_to_bank BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------
-- 5. Performance Indexes
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_scammers_user_id ON scammers(user_id);
CREATE INDEX IF NOT EXISTS idx_scammers_status ON scammers(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_scammer_id ON call_logs(scammer_id);
CREATE INDEX IF NOT EXISTS idx_fraud_accounts_scammer_id ON fraud_accounts(scammer_id);

-- ---------------------------------------------------------
-- 6. Row Level Security (RLS) & Access Control
-- ---------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scammers ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_accounts ENABLE ROW LEVEL SECURITY;

-- Idempotent Policy Setup (Drop existing policies if present)
DROP POLICY IF EXISTS "Allow full access for authenticated API" ON users;
DROP POLICY IF EXISTS "Allow full access for authenticated API" ON scammers;
DROP POLICY IF EXISTS "Allow full access for authenticated API" ON call_logs;
DROP POLICY IF EXISTS "Allow full access for authenticated API" ON fraud_accounts;

-- Grant access policies
CREATE POLICY "Allow full access for authenticated API" ON users FOR ALL USING (true);
CREATE POLICY "Allow full access for authenticated API" ON scammers FOR ALL USING (true);
CREATE POLICY "Allow full access for authenticated API" ON call_logs FOR ALL USING (true);
CREATE POLICY "Allow full access for authenticated API" ON fraud_accounts FOR ALL USING (true);
