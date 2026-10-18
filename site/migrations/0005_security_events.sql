-- Form protection log: accepted and blocked submissions. IPs are stored only
-- as salted hashes, used for rate limiting; never the raw address.
CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,        -- accepted | honeypot | too_fast | rate_limited | invalid_email | invalid_phone
  path TEXT NOT NULL,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_time ON security_events (created_at);
