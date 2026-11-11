// The Daily Brief: one email to each client's owner every morning.
//
// What's on the calendar today (read-only, if they connected it), any
// appointments that overlap, what is waiting on them, what came in since
// yesterday, and their hours this month. It goes to the owner only, never to a
// customer, and it is skipped on a day with nothing to say.

import { sendNotificationEmail } from "./email.js";
import { activeConnection, calendarEvents, hasCalendar } from "./connect.js";
import { statusFor, fmtMinutes } from "./hours.js";
import { openItems } from "./approvals.js";
import { makeLink } from "./links.js";

// ------------------------------------------------------------- pure logic --

// Minutes the time zone is ahead of UTC at that instant (New York in winter: -300).
export function tzOffsetMinutes(tz, date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

// The owner's local date and the UTC instants where that day starts and ends.
export function localDay(tz, now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  const at = (y, m, d) => {
    const guess = new Date(Date.UTC(y, m - 1, d));
    return new Date(guess.getTime() - tzOffsetMinutes(tz, guess) * 60000);
  };
  const start = at(+p.year, +p.month, +p.day);
  const end = at(+p.year, +p.month, +p.day + 1);
  return { date, start: start.toISOString(), end: end.toISOString() };
}

// Timed appointments that overlap each other.
export function findOverlaps(events) {
  const timed = events.filter((e) => !e.allDay).map((e) => ({ ...e, s: Date.parse(e.start), f: Date.parse(e.end) }))
    .filter((e) => e.f > e.s).sort((a, b) => a.s - b.s);
  const out = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length && timed[j].s < timed[i].f; j++) out.push([timed[i], timed[j]]);
  }
  return out;
}

const timeIn = (tz, iso) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export function composeClientBrief({ business, tz, now = new Date(), calendar, events = [], waiting = [], requests = [], came = {}, hours = null, paused = null, pauseUrl = null }) {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(now);
  const overlaps = findOverlaps(events);
  const lines = [`Good morning. Here's ${business}'s day, ${day}.`, ``];
  if (paused) {
    lines.push(`EVERYTHING IS PAUSED (since ${new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(paused.since))})`,
      `Your inbox isn't being read and nothing is sent on its own. Form requests come straight to you.`, `Resume: ${paused.resumeUrl}`, ``);
  }
  if (requests.length) {
    lines.push(`NEEDS YOUR YES OR NO (${requests.length})`);
    requests.forEach((r) => lines.push(`- ${r.text}`, `  Yes: ${r.yesUrl}`, `  No: ${r.noUrl}`));
    lines.push(``);
  }

  lines.push(`TODAY'S CALENDAR`);
  if (calendar === "not_connected") lines.push(`Your calendar isn't connected, so it isn't shown here. Reply to this email if you'd like it added.`);
  else if (calendar === "error") lines.push(`We couldn't read your calendar this morning. We're looking into it.`);
  else if (!events.length) lines.push(`Nothing on the calendar today.`);
  else {
    events.filter((e) => e.allDay).forEach((e) => lines.push(`- All day: ${e.title}${e.location ? ` (${e.location})` : ""}`));
    events.filter((e) => !e.allDay).forEach((e) => lines.push(`- ${timeIn(tz, e.start)} to ${timeIn(tz, e.end)}: ${e.title}${e.location ? ` (${e.location})` : ""}`));
  }
  if (overlaps.length) {
    lines.push(``, `OVERLAPS TO CHECK`);
    overlaps.forEach(([a, b]) => lines.push(`- "${a.title}" and "${b.title}" overlap at ${timeIn(tz, b.start)}.`));
  }

  lines.push(``, `WAITING ON YOU (${waiting.length})`);
  if (!waiting.length) lines.push(`Nothing right now.`);
  waiting.slice(0, 10).forEach((w) => {
    if (typeof w === "string") lines.push(`- ${w}`);
    else lines.push(`- ${w.text}`, ...(w.doneUrl ? [`  Done? ${w.doneUrl}`] : []));
  });
  if (waiting.length > 10) lines.push(`- and ${waiting.length - 10} more.`);
  if (waiting.some((w) => w && w.doneUrl)) lines.push(`Tap "Done" on anything you've handled and it leaves tomorrow's list.`);

  const bits = [came.drafted ? `${came.drafted} draft repl${came.drafted === 1 ? "y" : "ies"} in your Drafts folder` : "",
    came.formLeads ? `${came.formLeads} request${came.formLeads === 1 ? "" : "s"} through your form` : "",
    came.voice ? `${came.voice} voice note${came.voice === 1 ? "" : "s"} written up` : ""].filter(Boolean);
  lines.push(``, `SINCE YESTERDAY`, bits.length ? `- ${bits.join(", ")}.` : `- Nothing new came in.`);

  if (hours) lines.push(``, `YOUR HOURS THIS MONTH`, `- ${fmtMinutes(hours.used)} used of ${fmtMinutes(hours.available)}${hours.carry ? ` (including ${fmtMinutes(hours.carry)} rolled over)` : ""}.`);

  lines.push(``, `Nothing in this brief was sent to any customer. Reply to this email with anything you need.`);
  if (!paused && pauseUrl) lines.push(`Need everything to stop right now? Pause everything: ${pauseUrl}`);
  lines.push(``, `-- Minutes Regained, your Daily Brief`);
  const timed = events.filter((e) => !e.allDay).length;
  const subject = `${paused ? "PAUSED. " : ""}Your Daily Brief: ${calendar === "ok" ? `${events.length} on the calendar` : "today"}${requests.length ? `, ${requests.length} yes or no` : ""}${overlaps.length ? `, ${overlaps.length} overlap${overlaps.length === 1 ? "" : "s"}` : ""}${waiting.length ? `, ${waiting.length} waiting on you` : ""}`;
  const hasContent = !!paused || calendar === "ok" || waiting.length > 0 || requests.length > 0 || bits.length > 0;
  return { subject, text: lines.join("\n"), hasContent, overlaps: overlaps.length, timed };
}

// ------------------------------------------------------------------ send --

let ready = false;
async function ensureTable(env) {
  if (ready) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS client_brief_sent (
    agent_id TEXT NOT NULL, day TEXT NOT NULL, sent_at TEXT NOT NULL, PRIMARY KEY (agent_id, day))`).run();
  ready = true;
}

// Today's events for an agent, or null if no calendar is connected.
export async function todaysEvents(env, agent, now = new Date()) {
  const profile = JSON.parse(agent.profile || "{}");
  const conn = await activeConnection(env, agent.id);
  if (!conn || !hasCalendar(conn)) return null;
  const day = localDay(profile.timezone || "America/New_York", now);
  return calendarEvents(env, conn, day.start, day.end);
}

export async function buildBriefFor(env, agent, now = new Date()) {
  const profile = JSON.parse(agent.profile || "{}");
  const tz = profile.timezone || "America/New_York";
  const conn = await activeConnection(env, agent.id);
  let calendar = "not_connected", events = [];
  if (conn && hasCalendar(conn)) {
    try {
      const day = localDay(tz, now);
      events = (await calendarEvents(env, conn, day.start, day.end)) || [];
      calendar = "ok";
    } catch (err) {
      console.error("brief calendar failed", agent.id, err.message);
      calendar = "error";
    }
  }
  const since = new Date(now.getTime() - 24 * 3600000).toISOString();
  const { results: ev } = await env.DB.prepare(`SELECT kind, summary FROM client_agent_events WHERE agent_id = ? AND created_at >= ? ORDER BY id`)
    .bind(agent.id, since).all();
  // Waiting items stay until the owner marks them done (up to 7 days), with one-tap links.
  const open = await openItems(env, agent.id, makeLink, now).catch((err) => { console.error("open items failed", err); return { items: [], requests: [] }; });
  const waiting = open.items;
  const requests = open.requests;
  const came = {
    drafted: (ev || []).filter((e) => e.kind === "drafted").length,
    formLeads: (ev || []).filter((e) => e.kind === "form_lead").length,
    voice: (ev || []).filter((e) => e.kind === "voice_note").length,
  };
  const hours = await statusFor(env, agent).catch(() => null);
  const to = profile.ownerEmail || (conn && conn.email) || null;
  const paused = profile.pausedAt ? { since: profile.pausedAt, resumeUrl: await makeLink(env, { t: "pause", a: "resume", ag: agent.id }) } : null;
  const pauseUrl = paused ? null : await makeLink(env, { t: "pause", a: "pause", ag: agent.id }).catch(() => null);
  return { to, ...composeClientBrief({ business: profile.business || agent.label, tz, now, calendar, events, waiting, requests, came, hours, paused, pauseUrl }) };
}

// Morning run: one brief per active client, once per local day, only when
// there's something to say. force sends even if already sent or empty (admin test).
export async function sendClientBriefs(env, now = new Date(), { agentId, force = false } = {}) {
  await ensureTable(env);
  const { results: agents } = await env.DB.prepare(
    agentId ? `SELECT * FROM client_agents WHERE id = ?` : `SELECT * FROM client_agents WHERE status = 'active'`
  ).bind(...(agentId ? [agentId] : [])).all().catch(() => ({ results: [] }));
  const report = [];
  for (const agent of agents || []) {
    try {
      const profile = JSON.parse(agent.profile || "{}");
      const day = localDay(profile.timezone || "America/New_York", now).date;
      if (!force && await env.DB.prepare(`SELECT 1 FROM client_brief_sent WHERE agent_id = ? AND day = ?`).bind(agent.id, day).first()) continue;
      const brief = await buildBriefFor(env, agent, now);
      if (!brief.to) { report.push({ agentId: agent.id, skipped: "no_owner_email" }); continue; }
      if (!brief.hasContent && !force) { report.push({ agentId: agent.id, skipped: "nothing_to_say" }); continue; }
      await sendNotificationEmail(env, { to: brief.to, replyTo: "support@minutesregained.com", subject: brief.subject, text: brief.text });
      await env.DB.prepare(`INSERT INTO client_brief_sent (agent_id, day, sent_at) VALUES (?, ?, ?) ON CONFLICT(agent_id, day) DO NOTHING`)
        .bind(agent.id, day, new Date().toISOString()).run();
      report.push({ agentId: agent.id, sent: brief.subject });
    } catch (err) {
      console.error("client brief failed", agent.id, err.message);
      report.push({ agentId: agent.id, error: String(err.message || err).slice(0, 120) });
    }
  }
  return report;
}
