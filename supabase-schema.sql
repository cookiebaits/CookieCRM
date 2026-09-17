-- =========================================================
-- Scambaiter CRM - Supabase PostgreSQL Schema & Migrations
-- =========================================================
-- Run this in your Supabase Project -> SQL Editor to initialize all tables.

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  name TEXT NOT NULL,
  avatar_url TEXT,
  google_id TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'scambaiter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Scammers Table
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
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Call Logs Table
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

-- 4. Fraud Accounts / Mules Table
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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_scammers_user_id ON scammers(user_id);
CREATE INDEX IF NOT EXISTS idx_scammers_status ON scammers(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_scammer_id ON call_logs(scammer_id);
CREATE INDEX IF NOT EXISTS idx_fraud_accounts_scammer_id ON fraud_accounts(scammer_id);

-- Enable Row Level Security (RLS) but allow service role & application access
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scammers ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_accounts ENABLE ROW LEVEL SECURITY;

-- Allow public/authenticated read and write for the CRM application
CREATE POLICY "Allow full access for authenticated API" ON users FOR ALL USING (true);
CREATE POLICY "Allow full access for authenticated API" ON scammers FOR ALL USING (true);
CREATE POLICY "Allow full access for authenticated API" ON call_logs FOR ALL USING (true);
CREATE POLICY "Allow full access for authenticated API" ON fraud_accounts FOR ALL USING (true);
