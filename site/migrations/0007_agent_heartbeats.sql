-- Last check-in from each background agent that runs outside this Worker
-- (the Google Apps Script inbox agent), so the brief can say when one stops.
CREATE TABLE IF NOT EXISTS agent_heartbeats (
  agent TEXT PRIMARY KEY,
  last_seen TEXT NOT NULL,
  detail TEXT
);
