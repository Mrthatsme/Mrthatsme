// The GM's hours ledger: plan hours, the custom build, and the warning before
// a client goes past their hours.
//
// Every hands-on task a person does for a client is logged here in counted
// minutes (the time a skilled assistant would take, agreement clause 6).
// Plan hours come from the client's plan; unused hours roll over one month.
//
// A build (including the custom automation that comes with Business Support)
// is opened with an estimate, and every piece of time on it, from the first
// conversation to the finished build, is logged against it. The GM keeps a
// running projection. When what's left of the estimate won't fit in the hours
// the client has left, the client is told and asked for written OK before we
// go over. Time past the client's hours plus what they approved is refused,
// so extra hours can never be billed after the fact. When the build is marked
// done, the GM works out the total and how much of it was extra.
//
// Months are UTC calendar months, the same as the voice-note allowance.

import { PLANS } from "./plans.js";
import { sendNotificationEmail } from "./email.js";
import { voicePlan, monthKey } from "./usage.js";

export const KINDS = ["conversation", "research", "build", "testing", "admin"];
const MAX_ENTRY_MINUTES = 8 * 60;
const MAX_MONTHS_BACK = 36;

// ------------------------------------------------------------- pure logic --

export function fmtMinutes(min) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} hr ${r} min` : `${h} hr`;
}

export function extraCents(minutes, hourlyDollars) {
  return Math.round((minutes * hourlyDollars * 100) / 60);
}

export function prevMonthKey(key) {
  const [y, m] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function nextMonthKey(key) {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

// Hours rolled into `month`. Rolled-over hours are used first and expire after
// one month, so carry into a month is the part of last month's own plan hours
// that went unused. usedByMonth: { "2026-10": 310, ... }.
export function carryInto(month, startMonth, planMinutes, usedByMonth) {
  let carry = 0, m = startMonth, steps = 0;
  if (!startMonth || startMonth >= month) return 0;
  while (m < month && steps++ < MAX_MONTHS_BACK) {
    const used = usedByMonth[m] || 0;
    const fromPlan = used - Math.min(carry, used);
    carry = Math.max(0, planMinutes - fromPlan);
    m = nextMonthKey(m);
  }
  return carry;
}

// Where a month stands. limit is the most that can be logged: the client's
// hours plus any extra they approved in writing.
export function monthStatus({ planMinutes, carry, used, approved }) {
  const available = planMinutes + carry;
  const limit = available + approved;
  return {
    planMinutes, carry, available, approved, used, limit,
    left: Math.max(0, available - used),          // plan hours still unused
    headroom: Math.max(0, limit - used),         // including approved extra
    extraUsed: Math.max(0, used - available),
  };
}

// Is an open build heading past the client's hours? Projects the rest of the
// estimate against what's left (including any extra already approved).
export function buildProjection({ estimate, logged, headroom }) {
  if (estimate == null) return { remaining: null, short: 0 };
  const remaining = Math.max(0, estimate - logged);
  return { remaining, short: Math.max(0, remaining - headroom) };
}

// Split one month's entries, in the order they were logged, into the part
// covered by the client's hours and the part that was extra.
export function splitEntries(entries, available) {
  let used = 0;
  return entries.map((e) => {
    const within = Math.max(0, Math.min(e.minutes, available - used));
    used += e.minutes;
    return { ...e, within, extra: e.minutes - within };
  });
}

// ------------------------------------------------------------------ data --

let ready = false;
export async function ensureHoursTables(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS builds (
      id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, name TEXT NOT NULL, included_custom INTEGER NOT NULL DEFAULT 0,
      estimate_minutes INTEGER, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL,
      done_at TEXT, total_minutes INTEGER, extra_minutes INTEGER)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS hours_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT NOT NULL, month TEXT NOT NULL, work_date TEXT NOT NULL,
      minutes INTEGER NOT NULL, task TEXT NOT NULL, kind TEXT NOT NULL, build_id TEXT, logged_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_hours_log ON hours_log (agent_id, month, id)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS hours_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT NOT NULL, month TEXT NOT NULL,
      minutes INTEGER NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS hours_notices (
      key TEXT PRIMARY KEY, agent_id TEXT NOT NULL, created_at TEXT NOT NULL)`),
  ]);
  ready = true;
}

async function agentById(env, agentId) {
  return env.DB.prepare(`SELECT * FROM client_agents WHERE id = ?`).bind(agentId).first().catch(() => null);
}

// The plan behind an agent, if it has hours (Essential, Business Support).
async function hoursPlan(env, agent) {
  const { planId, billing } = await voicePlan(env, agent);
  const plan = planId && PLANS[planId];
  if (!plan || !plan.hours) return null;
  return { planId, label: plan.label, planMinutes: plan.hours * 60, hourly: plan.extraHourly, billing };
}

async function ownerEmail(env, agent) {
  const profile = JSON.parse(agent.profile || "{}");
  if (profile.ownerEmail) return profile.ownerEmail;
  const conn = await env.DB.prepare(`SELECT email FROM client_connections WHERE agent_id = ? AND status = 'active' ORDER BY connected_at DESC LIMIT 1`)
    .bind(agent.id).first().catch(() => null);
  return (conn && conn.email) || null;
}

export async function statusFor(env, agent, month = monthKey()) {
  await ensureHoursTables(env);
  const plan = await hoursPlan(env, agent);
  if (!plan) return null;
  const { results } = await env.DB.prepare(
    `SELECT month, SUM(minutes) AS used FROM hours_log WHERE agent_id = ? AND month <= ? GROUP BY month`
  ).bind(agent.id, month).all();
  const usedByMonth = Object.fromEntries((results || []).map((r) => [r.month, r.used]));
  const start = (agent.created_at || "").slice(0, 7) || month;
  const carry = carryInto(month, start, plan.planMinutes, usedByMonth);
  const ap = await env.DB.prepare(`SELECT COALESCE(SUM(minutes), 0) AS m FROM hours_approvals WHERE agent_id = ? AND month = ?`)
    .bind(agent.id, month).first();
  return { plan, month, ...monthStatus({ planMinutes: plan.planMinutes, carry, used: usedByMonth[month] || 0, approved: (ap && ap.m) || 0 }) };
}

async function buildLogged(env, buildId) {
  const r = await env.DB.prepare(`SELECT COALESCE(SUM(minutes), 0) AS m FROM hours_log WHERE build_id = ?`).bind(buildId).first();
  return (r && r.m) || 0;
}

// Sends a notice once per key. Returns true if this call sent it.
async function noticeOnce(env, key, agentId) {
  const r = await env.DB.prepare(`INSERT INTO hours_notices (key, agent_id, created_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING`)
    .bind(key, agentId, new Date().toISOString()).run();
  return !!(r.meta && r.meta.changes);
}

async function tell(env, agent, { subject, clientText, jeromeNote }) {
  const to = await ownerEmail(env, agent);
  const jobs = [];
  if (to) {
    jobs.push(sendNotificationEmail(env, { to, replyTo: "support@minutesregained.com", subject, text: `${clientText}\n\n-- Minutes Regained` }));
  }
  jobs.push(sendNotificationEmail(env, {
    subject: `[${agent.label}] ${subject}`,
    text: `${jeromeNote}\n\n${to ? `Sent to the client at ${to}:` : "NO CLIENT EMAIL ON FILE, so the client has NOT been told. Send this yourself:"}\n\n${clientText}`,
  }));
  const results = await Promise.allSettled(jobs);
  results.filter((r) => r.status === "rejected").forEach((r) => console.error("hours notice failed", r.reason));
}

// The warning: what's left of the build won't fit in the hours left.
async function warnIfHeadingPast(env, agent, build, status) {
  if (build.status !== "open") return null;
  const logged = await buildLogged(env, build.id);
  const proj = buildProjection({ estimate: build.estimate_minutes, logged, headroom: status.headroom });
  if (!proj.short) return null;
  // Once per build, month and limit: a new approval that still falls short warns again.
  if (!(await noticeOnce(env, `heading:${build.id}:${status.month}:${status.limit}`, agent.id))) return proj;
  const carryLine = status.carry ? ` (your ${fmtMinutes(status.planMinutes)} plan plus ${fmtMinutes(status.carry)} rolled over from last month)` : "";
  const approvedLine = status.approved ? `, including the ${fmtMinutes(status.approved)} of extra time you already approved` : "";
  const clientText = [
    logged
      ? `We're building ${build.name} for you. So far it has taken ${fmtMinutes(logged)}, and we expect about ${fmtMinutes(proj.remaining)} more to finish it.`
      : `We're about to build ${build.name} for you, and we expect it to take about ${fmtMinutes(proj.remaining)}.`,
    ``,
    `You have ${fmtMinutes(status.headroom)} left this month${approvedLine}${status.approved ? "" : carryLine}. That leaves the build about ${fmtMinutes(proj.short)} short.`,
    ``,
    `We won't go past your hours without your OK. Reply to this email with one of these:`,
    `- OK up to ${fmtMinutes(proj.short)} of extra time at $${status.plan.hourly} an hour (about $${(extraCents(proj.short, status.plan.hourly) / 100).toFixed(2)}).`,
    `- Pause the build and pick it up with next month's hours.`,
    `- Let's talk it through first.`,
    ``,
    `Until we hear from you, we only work within the hours you have.`,
  ].join("\n");
  await tell(env, agent, {
    subject: `${build.name} is heading past your plan hours`,
    clientText,
    jeromeNote: `Build ${build.id} is projected ${fmtMinutes(proj.short)} past this client's hours for ${status.month}. When they reply in writing, record it with POST /api/admin/hours-approval (agentId, minutes, note quoting their reply).`,
  });
  return proj;
}

// Told once per month and limit when a log is refused for want of hours.
async function tellBlocked(env, agent, status, build, wanted) {
  if (!(await noticeOnce(env, `blocked:${agent.id}:${status.month}:${status.limit}`, agent.id))) return;
  const what = build ? `the work on ${build.name}` : "the next piece of work you've handed us";
  await tell(env, agent, {
    subject: status.headroom ? `Your next task needs more than your hours left this month` : `You've reached your plan hours for this month`,
    clientText: [
      status.headroom
        ? `You have ${fmtMinutes(status.headroom)} left this month${status.approved ? `, including the extra time you approved` : ""}, and ${what} needs about ${fmtMinutes(wanted)}.`
        : `You've used all ${fmtMinutes(status.limit)} available this month${status.approved ? `, including the ${fmtMinutes(status.approved)} of extra time you approved` : ""}.`,
      ``,
      `We've paused ${status.headroom ? "it" : what} so nothing goes on your bill you haven't agreed to. Reply to this email if you'd like us to carry on at $${status.plan.hourly} an hour, and say up to how many hours. Otherwise we pick it up with next month's hours.`,
    ].join("\n"),
    jeromeNote: `A time entry was refused: no hours left for ${status.month}. Work stops here until the client approves extra time in writing.`,
  });
}

// ------------------------------------------------------------ admin calls --

const isMonth = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ""));
const whole = (n) => Number.isInteger(n) && n > 0;

export async function createBuild(env, { agentId, name, estimateMinutes, includedCustom }, now = new Date()) {
  await ensureHoursTables(env);
  const agent = await agentById(env, agentId);
  if (!agent) return { error: "agent_not_found" };
  if (!name || String(name).length > 120) return { error: "missing_name" };
  if (estimateMinutes != null && !whole(estimateMinutes)) return { error: "estimate_must_be_whole_minutes" };
  const plan = await hoursPlan(env, agent);
  if (!plan) return { error: "no_plan_hours", message: "Link this client's plan first (client-links, clientId or plan)." };
  if (includedCustom) {
    if (plan.planId !== "business_support") return { error: "included_custom_is_business_support_only" };
    const had = await env.DB.prepare(`SELECT id FROM builds WHERE agent_id = ? AND included_custom = 1`).bind(agentId).first();
    if (had) return { error: "included_custom_already_exists", buildId: had.id };
  }
  const id = "bd_" + [...crypto.getRandomValues(new Uint8Array(5))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await env.DB.prepare(`INSERT INTO builds (id, agent_id, name, included_custom, estimate_minutes, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, agentId, String(name), includedCustom ? 1 : 0, estimateMinutes ?? null, now.toISOString()).run();
  const build = await env.DB.prepare(`SELECT * FROM builds WHERE id = ?`).bind(id).first();
  const status = await statusFor(env, agent, monthKey(now));
  const projection = await warnIfHeadingPast(env, agent, build, status);
  return { build, status, projection };
}

export async function updateEstimate(env, { buildId, estimateMinutes }, now = new Date()) {
  await ensureHoursTables(env);
  if (!whole(estimateMinutes)) return { error: "estimate_must_be_whole_minutes" };
  const build = await env.DB.prepare(`SELECT * FROM builds WHERE id = ?`).bind(buildId).first();
  if (!build) return { error: "build_not_found" };
  if (build.status !== "open") return { error: "build_is_done" };
  await env.DB.prepare(`UPDATE builds SET estimate_minutes = ? WHERE id = ?`).bind(estimateMinutes, buildId).run();
  const agent = await agentById(env, build.agent_id);
  const status = await statusFor(env, agent, monthKey(now));
  const projection = await warnIfHeadingPast(env, agent, { ...build, estimate_minutes: estimateMinutes }, status);
  return { ok: true, status, projection };
}

// Log counted time. Refused past the client's hours plus approved extra.
export async function logTime(env, { agentId, minutes, task, kind = "admin", buildId, workDate }, now = new Date()) {
  await ensureHoursTables(env);
  const agent = await agentById(env, agentId);
  if (!agent) return { error: "agent_not_found" };
  if (!whole(minutes) || minutes > MAX_ENTRY_MINUTES) return { error: "minutes_must_be_1_to_480" };
  if (!task || String(task).length > 200) return { error: "missing_task" };
  if (!KINDS.includes(kind)) return { error: "bad_kind", allowed: KINDS };
  const month = monthKey(now);
  const date = workDate || now.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.slice(0, 7) !== month) return { error: "work_date_must_be_this_month", month };
  let build = null;
  if (buildId) {
    build = await env.DB.prepare(`SELECT * FROM builds WHERE id = ? AND agent_id = ?`).bind(buildId, agentId).first();
    if (!build) return { error: "build_not_found" };
    if (build.status !== "open") return { error: "build_is_done" };
  }
  const status = await statusFor(env, agent, month);
  if (!status) return { error: "no_plan_hours" };
  if (minutes > status.headroom) {
    await tellBlocked(env, agent, status, build, minutes);
    return { error: "needs_client_ok", minutesLeft: status.headroom, status,
      message: `Only ${fmtMinutes(status.headroom)} left this month including approved extra. The client has been asked; record their written OK with /api/admin/hours-approval.` };
  }
  await env.DB.prepare(`INSERT INTO hours_log (agent_id, month, work_date, minutes, task, kind, build_id, logged_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(agentId, month, date, minutes, String(task), kind, buildId || null, now.toISOString()).run();
  const after = await statusFor(env, agent, month);
  // Check every open build: time on any task eats into what's left for them.
  const { results: open } = await env.DB.prepare(`SELECT * FROM builds WHERE agent_id = ? AND status = 'open'`).bind(agentId).all();
  const warnings = [];
  for (const b of open || []) {
    const p = await warnIfHeadingPast(env, agent, b, after);
    if (p && p.short) warnings.push({ buildId: b.id, ...p });
  }
  return { ok: true, status: after, warnings };
}

// The client's written OK for extra time this month. note must say where it
// came from, e.g. "Email from Dana, Nov 12: OK up to 2 more hours".
export async function recordApproval(env, { agentId, minutes, note, month }, now = new Date()) {
  await ensureHoursTables(env);
  const agent = await agentById(env, agentId);
  if (!agent) return { error: "agent_not_found" };
  if (!whole(minutes)) return { error: "minutes_must_be_whole" };
  if (!note || String(note).trim().length < 10) return { error: "note_must_quote_the_written_ok" };
  const m = month || monthKey(now);
  if (!isMonth(m) || m < monthKey(now)) return { error: "approval_must_be_this_month_or_later" };
  await env.DB.prepare(`INSERT INTO hours_approvals (agent_id, month, minutes, note, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(agentId, m, minutes, String(note).slice(0, 400), now.toISOString()).run();
  return { ok: true, status: await statusFor(env, agent, m) };
}

// Per-entry split for one month, in logged order.
async function splitMonth(env, agent, month) {
  const status = await statusFor(env, agent, month);
  const { results } = await env.DB.prepare(`SELECT * FROM hours_log WHERE agent_id = ? AND month = ? ORDER BY id`).bind(agent.id, month).all();
  return { status, entries: status ? splitEntries(results || [], status.available) : [] };
}

// Mark a build done. The GM totals every minute logged to it, across months,
// and how much of that was extra (approved) time.
export async function finishBuild(env, { buildId }) {
  await ensureHoursTables(env);
  const build = await env.DB.prepare(`SELECT * FROM builds WHERE id = ?`).bind(buildId).first();
  if (!build) return { error: "build_not_found" };
  if (build.status !== "open") return { error: "build_is_done" };
  const agent = await agentById(env, build.agent_id);
  const { results: months } = await env.DB.prepare(`SELECT DISTINCT month FROM hours_log WHERE build_id = ? ORDER BY month`).bind(buildId).all();
  let total = 0, extra = 0;
  const byKind = {};
  for (const { month } of months || []) {
    const { entries } = await splitMonth(env, agent, month);
    for (const e of entries.filter((x) => x.build_id === buildId)) {
      total += e.minutes; extra += e.extra;
      byKind[e.kind] = (byKind[e.kind] || 0) + e.minutes;
    }
  }
  await env.DB.prepare(`UPDATE builds SET status = 'done', done_at = ?, total_minutes = ?, extra_minutes = ? WHERE id = ?`)
    .bind(new Date().toISOString(), total, extra, buildId).run();
  const plan = await hoursPlan(env, agent);
  const hourly = plan ? plan.hourly : 95;
  const kinds = Object.entries(byKind).map(([k, m]) => `${k} ${fmtMinutes(m)}`).join(", ");
  const extraLine = extra
    ? `${fmtMinutes(total - extra)} came out of your plan hours. The other ${fmtMinutes(extra)} was extra time you approved in writing, at $${hourly} an hour: $${(extraCents(extra, hourly) / 100).toFixed(2)}, which we'll bill separately.`
    : `All of it came out of your plan hours. Nothing extra to pay.`;
  await tell(env, agent, {
    subject: `${build.name} is finished`,
    clientText: [
      `${build.name} is built and running.`,
      ``,
      `Total time, from our first conversation about it to the finished build: ${fmtMinutes(total)}${build.estimate_minutes ? ` (we estimated ${fmtMinutes(build.estimate_minutes)})` : ""}.`,
      extraLine,
      ``,
      `Every entry is on your monthly report.`,
    ].join("\n"),
    jeromeNote: `Build ${buildId} closed. ${fmtMinutes(total)} total (${kinds || "no time logged"}). Extra: ${fmtMinutes(extra)}${extra ? `, $${(extraCents(extra, hourly) / 100).toFixed(2)} to bill. Not billed automatically.` : "."}`,
  });
  return { ok: true, buildId, totalMinutes: total, extraMinutes: extra, extraCents: extraCents(extra, hourly), byKind };
}

// The monthly report: every entry, what it counted as, and the totals.
export async function monthlyStatement(env, { agentId, month }) {
  await ensureHoursTables(env);
  const agent = await agentById(env, agentId);
  if (!agent) return { error: "agent_not_found" };
  const m = month || monthKey();
  if (!isMonth(m)) return { error: "bad_month" };
  const { status, entries } = await splitMonth(env, agent, m);
  if (!status) return { error: "no_plan_hours" };
  const { results: approvals } = await env.DB.prepare(`SELECT minutes, note, created_at FROM hours_approvals WHERE agent_id = ? AND month = ? ORDER BY id`).bind(agentId, m).all();
  const { results: builds } = await env.DB.prepare(`SELECT * FROM builds WHERE agent_id = ? ORDER BY created_at`).bind(agentId).all();
  const extra = entries.reduce((n, e) => n + e.extra, 0);
  return {
    client: agent.label, plan: status.plan.label, month: m,
    entries: entries.map((e) => ({ date: e.work_date, task: e.task, kind: e.kind, buildId: e.build_id, counted: e.minutes, withinPlan: e.within, extra: e.extra })),
    totals: { planMinutes: status.planMinutes, rolledIn: status.carry, used: status.used, approvedExtra: status.approved, extraUsed: extra,
      extraCents: extraCents(extra, status.plan.hourly), rollsOver: Math.max(0, status.planMinutes - Math.max(0, status.used - status.carry)) },
    approvals: approvals || [],
    builds: (builds || []).map((b) => ({ id: b.id, name: b.name, includedCustom: !!b.included_custom, status: b.status, estimate: b.estimate_minutes, total: b.total_minutes })),
  };
}

// ------------------------------------------------------------- the brief --

// One or two lines per client for the owner-operator brief.
export async function hoursLines(env, agent) {
  const status = await statusFor(env, agent).catch(() => null);
  if (!status) return [];
  const { results: open } = await env.DB.prepare(`SELECT * FROM builds WHERE agent_id = ? AND status = 'open'`).bind(agent.id).all();
  if (!status.used && !(open || []).length) return [];
  const lines = [`  Hours this month: ${fmtMinutes(status.used)} of ${fmtMinutes(status.available)}${status.carry ? ` (incl. ${fmtMinutes(status.carry)} rolled over)` : ""}${status.approved ? `, plus ${fmtMinutes(status.approved)} extra approved` : ""}${status.extraUsed ? `. EXTRA USED: ${fmtMinutes(status.extraUsed)}` : ""}.`];
  for (const b of open || []) {
    const logged = await buildLogged(env, b.id);
    const p = buildProjection({ estimate: b.estimate_minutes, logged, headroom: status.headroom });
    lines.push(`  Build "${b.name}": ${fmtMinutes(logged)} so far${b.estimate_minutes ? ` of ~${fmtMinutes(b.estimate_minutes)}` : ", no estimate set"}.${p.short ? ` HEADING PAST HOURS BY ${fmtMinutes(p.short)}: waiting on the client's written OK.` : ""}`);
  }
  return lines;
}

// On the 1st: tell Jerome what extra time to bill for last month. Nothing is
// charged automatically; every minute listed was approved in writing.
export async function extraHoursReport(env, now = new Date()) {
  await ensureHoursTables(env);
  const prev = prevMonthKey(monthKey(now));
  const { results: agents } = await env.DB.prepare(`SELECT * FROM client_agents WHERE status = 'active'`).all();
  const report = [];
  for (const agent of agents || []) {
    const { status, entries } = await splitMonth(env, agent, prev);
    if (!status) continue;
    const extra = entries.reduce((n, e) => n + e.extra, 0);
    if (!extra) continue;
    report.push(`- ${agent.label}: ${fmtMinutes(extra)} extra in ${prev} (approved ${fmtMinutes(status.approved)}), $${(extraCents(extra, status.plan.hourly) / 100).toFixed(2)} at $${status.plan.hourly}/hr.`);
  }
  if (report.length && (await noticeOnce(env, `extra-report:${prev}`, "all"))) {
    await sendNotificationEmail(env, {
      subject: `Extra hours to bill for ${prev}`,
      text: `${report.join("\n")}\n\nEvery minute here was approved in writing before it was worked. Nothing has been charged; bill these yourself.`,
    }).catch((err) => console.error("extra hours report failed", err));
  }
  return report;
}

// ------------------------------------------------------ admin dashboard --

// Every active client with plan hours: where the month stands and each build.
export async function dashboardHours(env, now = new Date()) {
  await ensureHoursTables(env);
  const { results: agents } = await env.DB.prepare(`SELECT * FROM client_agents WHERE status = 'active' ORDER BY label`).all()
    .catch(() => ({ results: [] }));
  const out = [];
  for (const agent of agents || []) {
    const status = await statusFor(env, agent, monthKey(now)).catch(() => null);
    if (!status) continue;
    const { results: builds } = await env.DB.prepare(`SELECT * FROM builds WHERE agent_id = ? ORDER BY status DESC, created_at`).bind(agent.id).all();
    const list = [];
    for (const b of builds || []) {
      const logged = await buildLogged(env, b.id);
      const p = b.status === "open" ? buildProjection({ estimate: b.estimate_minutes, logged, headroom: status.headroom }) : { short: 0 };
      list.push({ id: b.id, name: b.name, includedCustom: !!b.included_custom, status: b.status, estimate: b.estimate_minutes,
        logged, short: p.short, total: b.total_minutes, extra: b.extra_minutes });
    }
    out.push({ id: agent.id, label: agent.label, plan: status.plan.label, hourly: status.plan.hourly, month: status.month,
      planMinutes: status.planMinutes, carry: status.carry, approved: status.approved, used: status.used,
      available: status.available, headroom: status.headroom, extraUsed: status.extraUsed, builds: list });
  }
  return out;
}
