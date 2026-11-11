// The GM's watch: every 10 minutes, right after the inbox check.
//
// Looks for things that shouldn't wait for the 8 AM brief: a client's inbox
// disconnected or no longer being checked, a client agent gone quiet, our own
// inbox script stopped, website inquiries stuck, and Jerome's logged hours
// nearing the restructure trigger (Decision Log 14.20). Jerome gets one email
// when a problem starts and one when it clears, never one every 10 minutes.
//
// Each run is recorded, and /api/health reports it, so an outside uptime
// monitor can raise the alarm if the watch itself stops: nothing inside the
// Worker can report its own silence.

import { sendNotificationEmail } from "./email.js";

const MIN = 60000;
export const POLL_STALE_MIN = 40;          // inboxes are checked every 10 minutes
export const AGENT_QUIET_HOURS = 3;        // client inbox scripts check in hourly
export const SCRIPT_STALE_HOURS = 3;       // our own inbox script runs hourly
export const WATCH_STALE_MIN = 30;         // /api/health fails after this
export const CAPACITY_NEAR_HRS = 12;       // a heads-up before the trigger
export const CAPACITY_TRIGGER_HRS = 15;    // Decision Log 14.20

// Average hours a week over the last 30 days.
export const weeklyHours = (minutes30) => Math.round((minutes30 / 30) * 7 / 6) / 10;

// The problems right now: [{ key, title }]. Pure data from D1.
export async function currentProblems(env, now = new Date()) {
  const problems = [];
  const q = (sql, ...b) => env.DB.prepare(sql).bind(...b).all().then((r) => r.results || []).catch(() => []);
  const ago = (iso) => (now - new Date(iso)) / MIN;

  // Clients: connected inboxes and inbox scripts.
  const agents = await q(`SELECT id, label, last_seen, created_at, profile FROM client_agents WHERE status = 'active'`);
  for (const a of agents) {
    if (JSON.parse(a.profile || "{}").pausedAt) continue;   // paused on purpose: nothing should be running
    const conn = (await q(`SELECT id, email, status, last_poll, connected_at FROM client_connections WHERE agent_id = ? ORDER BY connected_at DESC LIMIT 1`, a.id))[0];
    if (conn && conn.status === "disconnected") {
      problems.push({ key: `disconnected:${a.id}`, title: `${a.label}: ${conn.email || "the inbox"} was disconnected. Send a new connect link if that wasn't intended.` });
    } else if (conn && conn.status === "active") {
      const since = conn.last_poll || conn.connected_at;
      if (since && ago(since) > POLL_STALE_MIN) {
        problems.push({ key: `polling:${conn.id}`, title: `${a.label}: ${conn.email} hasn't been checked for ${Math.round(ago(since))} minutes. New customer email isn't being drafted.` });
      }
    } else if (!conn && a.last_seen && ago(a.last_seen) > AGENT_QUIET_HOURS * 60) {
      problems.push({ key: `quiet:${a.id}`, title: `${a.label}: the inbox agent last checked in ${Math.round(ago(a.last_seen) / 60)} hours ago.` });
    }
  }

  // Our own inbox script (Apps Script), once it has ever checked in.
  const script = (await q(`SELECT last_seen FROM agent_heartbeats WHERE agent = 'inbox'`))[0];
  if (script && ago(script.last_seen) > SCRIPT_STALE_HOURS * 60) {
    problems.push({ key: "script:inbox", title: `Your own inbox script last checked in ${Math.round(ago(script.last_seen) / 60)} hours ago. Open script.google.com > Executions.` });
  }

  // Website inquiries the assistant never processed (30 minutes to 7 days old).
  const stuck = await q(`SELECT COUNT(*) AS n FROM leads WHERE triage_status IS NULL AND created_at < ? AND created_at > ? AND status != 'test'`,
    new Date(now - 30 * MIN).toISOString(), new Date(now - 7 * 1440 * MIN).toISOString());
  if (stuck[0] && stuck[0].n) problems.push({ key: "triage:stuck", title: `${stuck[0].n} website inquiry(ies) haven't been processed after 30 minutes. Answer them from the dashboard.` });

  // Capacity: hours actually logged, last 30 days, all clients.
  const logged = await q(`SELECT COALESCE(SUM(minutes), 0) AS m FROM hours_log WHERE logged_at >= ?`, new Date(now - 30 * 1440 * MIN).toISOString());
  const hrs = weeklyHours((logged[0] && logged[0].m) || 0);
  if (hrs >= CAPACITY_TRIGGER_HRS) {
    problems.push({ key: "capacity:trigger", title: `You've averaged ${hrs} logged hours a week over the last 30 days. That's the restructure trigger (15 a week): time to hold the decision in Decision Log 14.20.` });
  } else if (hrs >= CAPACITY_NEAR_HRS) {
    problems.push({ key: "capacity:near", title: `You've averaged ${hrs} logged hours a week over the last 30 days, nearing the 15-a-week restructure trigger.` });
  }
  return problems;
}

let ready = false;
async function ensureTable(env) {
  if (ready) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS gm_alerts (
    key TEXT PRIMARY KEY, title TEXT NOT NULL, opened_at TEXT NOT NULL, resolved_at TEXT)`).run();
  ready = true;
}

// One run: compare with what's already open, email Jerome about anything new
// or cleared, and record the run.
export async function gmWatch(env, now = new Date()) {
  await ensureTable(env);
  const problems = await currentProblems(env, now);
  const { results: open } = await env.DB.prepare(`SELECT key, title FROM gm_alerts WHERE resolved_at IS NULL`).all();
  const openKeys = new Set((open || []).map((r) => r.key));
  const nowKeys = new Set(problems.map((p) => p.key));
  const fresh = problems.filter((p) => !openKeys.has(p.key));
  const cleared = (open || []).filter((r) => !nowKeys.has(r.key));
  for (const p of fresh) {
    await env.DB.prepare(`INSERT INTO gm_alerts (key, title, opened_at, resolved_at) VALUES (?, ?, ?, NULL)
      ON CONFLICT(key) DO UPDATE SET title = excluded.title, opened_at = excluded.opened_at, resolved_at = NULL`).bind(p.key, p.title, now.toISOString()).run();
  }
  for (const r of cleared) await env.DB.prepare(`UPDATE gm_alerts SET resolved_at = ? WHERE key = ?`).bind(now.toISOString(), r.key).run();
  if (fresh.length || cleared.length) {
    const lines = [
      ...(fresh.length ? [`NEW (${fresh.length})`, ...fresh.map((p) => `- ${p.title}`), ``] : []),
      ...(cleared.length ? [`BACK TO NORMAL (${cleared.length})`, ...cleared.map((r) => `- ${r.title}`), ``] : []),
      `Still open: ${problems.length}. The GM checks every 10 minutes and only emails when something starts or clears.`,
    ];
    await sendNotificationEmail(env, {
      subject: fresh.length ? `[GM watch] ${fresh.length} new problem${fresh.length === 1 ? "" : "s"}` : `[GM watch] back to normal`,
      text: lines.join("\n"),
    }).catch((err) => console.error("GM watch email failed", err));
  }
  await env.DB.prepare(`INSERT INTO agent_heartbeats (agent, last_seen, detail) VALUES ('gm-watch', ?, ?)
    ON CONFLICT(agent) DO UPDATE SET last_seen = excluded.last_seen, detail = excluded.detail`).bind(now.toISOString(), `${problems.length} open`).run();
  return { open: problems.length, fresh: fresh.length, cleared: cleared.length };
}

// For an outside uptime monitor: 200 while the watch is running, 503 if it stopped.
export async function watchHealth(env, now = new Date()) {
  const row = await env.DB.prepare(`SELECT last_seen FROM agent_heartbeats WHERE agent = 'gm-watch'`).first().catch(() => null);
  const minutes = row ? Math.round((now - new Date(row.last_seen)) / MIN) : null;
  return { ok: minutes !== null && minutes <= WATCH_STALE_MIN, lastRunMinutesAgo: minutes };
}
