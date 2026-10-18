-- One row per Retainer renewal notice sent, so each client gets exactly one
-- 30-day notice per renewal.
CREATE TABLE IF NOT EXISTS renewal_notices (
  stripe_subscription_id TEXT NOT NULL,
  period_end TEXT NOT NULL,
  client_id TEXT,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (stripe_subscription_id, period_end)
);
