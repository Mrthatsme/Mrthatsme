-- The GM's hours ledger (src/hours.js). The code also creates these on first
-- use, so this file is for a fresh database or a look at the schema.
CREATE TABLE IF NOT EXISTS builds (
  id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, name TEXT NOT NULL, included_custom INTEGER NOT NULL DEFAULT 0,
  estimate_minutes INTEGER, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL,
  done_at TEXT, total_minutes INTEGER, extra_minutes INTEGER);
CREATE TABLE IF NOT EXISTS hours_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT NOT NULL, month TEXT NOT NULL, work_date TEXT NOT NULL,
  minutes INTEGER NOT NULL, task TEXT NOT NULL, kind TEXT NOT NULL, build_id TEXT, logged_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_hours_log ON hours_log (agent_id, month, id);
CREATE TABLE IF NOT EXISTS hours_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT NOT NULL, month TEXT NOT NULL,
  minutes INTEGER NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hours_notices (
  key TEXT PRIMARY KEY, agent_id TEXT NOT NULL, created_at TEXT NOT NULL);
