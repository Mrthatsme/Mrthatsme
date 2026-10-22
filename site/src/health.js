import { PLANS } from "./plans.js";

// Scoreboard, system health and the weekly spot-check for the twice-daily
// brief. Everything here is plain D1 data -- no model calls.

const AGENTS = { inbox: "Inbox agent (Gmail)" };
const HEARTBEAT_STALE_HOURS = 3;     // it runs hourly; 3 missed runs means it stopped
export const isTest = (l) => l.status === "test" || /^qa test$/i.test(String(l.name || "").trim());

function minutesBetween(a, b) {
  return (new Date(b) - new Date(a)) / 60000;
}


const usd = (cents) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

export async function recordHeartbeat(env, agent, detail) {
  if (!AGENTS[agent]) return false;
  await env.DB.prepare(
    `INSERT INTO agent_heartbeats (agent, last_seen, detail) VALUES (?, ?, ?)
     ON CONFLICT(agent) DO UPDATE SET last_seen = excluded.last_seen, detail = excluded.detail`
  ).bind(agent, new Date().toISOString(), String(detail || "").slice(0, 200)).run();
  return true;
}

// Last 7 days against the 7 before, so the trend is visible at a glance.
export function scoreboardLines(leads, contracts, clients, now = new Date()) {
  const day = 86400000;
  const real = leads.filter((l) => !isTest(l));
  const inRange = (iso, fromDays, toDays) => iso && iso >= new Date(now - fromDays * day).toISOString() && iso < new Date(now - toDays * day).toISOString();
  const week = real.filter((l) => inRange(l.created_at, 7, 0));
  const prev = real.filter((l) => inRange(l.created_at, 14, 7));
  const signedWeek = contracts.filter((c) => inRange(c.created_at, 7, 0) && c.status === "active").length;
  const leads30 = real.filter((l) => inRange(l.created_at, 30, 0)).length;
  const signed30 = contracts.filter((c) => inRange(c.created_at, 30, 0) && c.status === "active").length;
  const mrr = clients.filter((c) => c.status === "active").reduce((sum, c) => {
    const plan = PLANS[c.plan_id];
    return sum + (plan ? plan.priceCents : 0);
  }, 0);

  return [
    `SCOREBOARD (last 7 days, the 7 before in brackets)`,
    `- New inquiries: ${week.length} (${prev.length})`,
    `- Waiting on your answer: every inquiry gets an instant "we got your message"; you send the real reply`,
    `- New paying clients: ${signedWeek}`,
    `- Close rate, last 30 days: ${leads30 ? `${signed30} of ${leads30} inquiries (${Math.round((signed30 / leads30) * 100)}%)` : "no inquiries yet"}`,
    `- Monthly revenue at standard prices: ${usd(mrr)} from ${clients.filter((c) => c.status === "active").length} active client(s)`,
  ];
}

// Returns { lines, problems } -- problems > 0 flags the brief's subject line.
export async function healthLines(env, leads, now = new Date()) {
  const lines = [`SYSTEM HEALTH`];
  let problems = 0;

  const { results } = await env.DB.prepare(`SELECT agent, last_seen FROM agent_heartbeats`).all().catch(() => ({ results: [] }));
  const seen = Object.fromEntries((results || []).map((r) => [r.agent, r.last_seen]));
  for (const [id, label] of Object.entries(AGENTS)) {
    if (!seen[id]) { lines.push(`- ${label}: not connected yet (one-time step on the setup page)`); continue; }
    const hrs = (now - new Date(seen[id])) / 3600000;
    if (hrs > HEARTBEAT_STALE_HOURS) {
      problems++;
      lines.push(`- ${label}: STOPPED? Last checked in ${Math.round(hrs)} hours ago. Open script.google.com > Executions to see the error.`);
    } else {
      lines.push(`- ${label}: OK, checked in ${hrs < 1 ? `${Math.max(1, Math.round(hrs * 60))} min` : `${Math.round(hrs)} hr`} ago`);
    }
  }

  const since = new Date(now - 12 * 3600000).toISOString();
  const recent = leads.filter((l) => (l.created_at || "") >= since);
  const failed = recent.filter((l) => l.triage_status === "failed");
  const stuck = leads.filter((l) => !l.triage_status && l.created_at && minutesBetween(l.created_at, now) > 30 && minutesBetween(l.created_at, now) < 7 * 1440);
  if (failed.length) { problems++; lines.push(`- Inquiry assistant: ${failed.length} inquiry(ies) it couldn't process. They're listed under NEEDS YOU; answer them yourself.`); }
  if (stuck.length) { problems++; lines.push(`- Inquiry assistant: ${stuck.length} inquiry(ies) never processed (over 30 min old). Check the dashboard.`); }
  if (!failed.length && !stuck.length) lines.push(`- Inquiry assistant: OK`);

  const cap = Number(env.TRIAGE_DAILY_CAP) || 50;
  const usage = await env.DB.prepare(`SELECT calls FROM triage_usage WHERE usage_date = ?`)
    .bind(now.toISOString().slice(0, 10)).first().catch(() => null);
  if (usage && usage.calls >= cap) { problems++; lines.push(`- Daily limit of ${cap} inquiry checks reached; inquiries still get the acknowledgement, without a suggested reply, until midnight UTC.`); }

  return { lines, problems };
}
