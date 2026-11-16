-- Minutes Regained client portal (D1 / SQLite).
-- Apply with: npx wrangler d1 execute mr-portal --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  industry TEXT,
  stage TEXT NOT NULL DEFAULT 'prospect',      -- see STAGES in src/index.js
  stage_updated_at TEXT,
  plan TEXT,                                   -- Essential / Business Support / Custom Build
  plan_price_cents INTEGER,
  founding INTEGER NOT NULL DEFAULT 0,
  hours_included REAL NOT NULL DEFAULT 0,
  hours_used REAL NOT NULL DEFAULT 0,
  next_invoice_date TEXT,
  paused INTEGER NOT NULL DEFAULT 0,
  next_step TEXT,                              -- shown to the client on the overview
  source TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,  -- NULL for admins
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'client',         -- client | admin
  password_hash TEXT,
  password_salt TEXT,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | approved | declined
  client_note TEXT,
  decided_at TEXT,
  decided_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  report_date TEXT NOT NULL,
  summary TEXT NOT NULL,
  needs_you TEXT, handled TEXT, call_back TEXT, system_check TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule TEXT,
  level TEXT NOT NULL DEFAULT 'Ask me',        -- Do it | Tell me | Ask me | Never
  status TEXT NOT NULL DEFAULT 'In setup',     -- In setup | Read-only | Running | Needs attention
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id TEXT,
  body TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'This week',
  status TEXT NOT NULL DEFAULT 'Received',     -- Received | In progress | Done
  reply TEXT,
  hours REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  meta TEXT,
  url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invoice_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Paid',         -- Paid | Due | Overdue
  url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (                -- internal only, never shown to clients
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,                          -- 'client' | 'team' | 'system'
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_account ON users(account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_approvals_acct ON approvals(account_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_acct ON reports(account_id, report_date);
CREATE INDEX IF NOT EXISTS idx_requests_acct ON requests(account_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_acct ON activity(account_id, created_at);
