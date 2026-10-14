-- Tracks what the triage agent decided about each inbound lead, so the
-- admin dashboard shows what went out automatically vs what's waiting on
-- a human, without digging through email history.

ALTER TABLE leads ADD COLUMN triage_status TEXT;      -- auto_replied | escalated | failed | null (not yet triaged)
ALTER TABLE leads ADD COLUMN triage_note TEXT;          -- escalation reason, or a short summary of the auto-reply
ALTER TABLE leads ADD COLUMN triage_reply_body TEXT;    -- the exact text sent to the prospect, when auto-replied
ALTER TABLE leads ADD COLUMN triaged_at TEXT;

-- One row per UTC date; gates how many triage LLM calls can run per day so
-- a traffic spike or abuse can't run up an unbounded API bill. Once the cap
-- is hit, new leads fall back to plain human-notify (no auto-answer) --
-- never a hard failure, just a safe default.
CREATE TABLE IF NOT EXISTS triage_usage (
  usage_date TEXT PRIMARY KEY,   -- YYYY-MM-DD (UTC)
  calls INTEGER NOT NULL DEFAULT 0
);

