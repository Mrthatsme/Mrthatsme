import { PLANS } from "./plans.js";

// Scoreboard, system health and the weekly spot-check for the twice-daily
// brief. Everything here is plain D1 data -- no model calls.

const AGENTS = { inbox: "Inbox agent (Gmail)" };
const HEARTBEAT_STALE_HOURS = 3;     // it runs hourly; 3 missed runs means it stopped
const AUTO_REPLY_TARGET_MIN = 5;     // first reply to a new inquiry, when the site can answer it
const isTest = (l) => l.status === "test" || /^qa test$/i.test(String(l.name || "").trim());

function minutesBetween(a, b) {
  return (new Date(b) - new Date(a)) / 60000;
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const fmtMin = (m) => (m < 1 ? "under 1 min" : m < 90 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} hrs`);
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
  const auto = week.filter((l) => l.triage_status === "auto_replied" && l.triaged_at);
  const speed = median(auto.map((l) => minutesBetween(l.created_at, l.triaged_at)));
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
    `- Answered automatically: ${auto.length} of ${week.length}` +
      (speed === null ? "" : `, typically in ${fmtMin(speed)} (target: under ${AUTO_REPLY_TARGET_MIN} min)${speed > AUTO_REPLY_TARGET_MIN ? "  << SLOW" : ""}`),
    `- Sent to you to answer: ${week.filter((l) => l.triage_status === "escalated").length}`,
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
  if (usage && usage.calls >= cap) { problems++; lines.push(`- Daily limit of ${cap} automatic answers reached; new inquiries go to you until midnight UTC.`); }

  return { lines, problems };
}

// Monday mornings: three recent automatic answers for a human to check.
export function spotCheckLines(leads, now = new Date()) {
  const since = new Date(now - 7 * 86400000).toISOString();
  const auto = leads.filter((l) => !isTest(l) && l.triage_status === "auto_replied" && (l.created_at || "") >= since && l.triage_reply_body);
  const pick = auto.sort(() => Math.random() - 0.5).slice(0, 3);
  const lines = [`WEEKLY SPOT-CHECK: were these automatic answers right? (${pick.length} of ${auto.length} this week)`];
  if (!pick.length) return [...lines, "No automatic answers this week."];
  pick.forEach((l, i) => {
    lines.push(
      `${i + 1}. ${l.name} (${l.business}) asked:`,
      `   "${String(l.pain || "(no message)").trim().slice(0, 240)}"`,
      `   The site replied:`,
      ...String(l.triage_reply_body).trim().slice(0, 600).split("\n").map((s) => `   | ${s}`),
    );
  });
  lines.push(`If any answer was wrong or off-tone, tell Claude which one and why, and the assistant's instructions get tightened.`);
  return lines;
}
