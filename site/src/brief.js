import { listLeads, listContracts, listClients, listPayments } from "./db.js";
import { sendNotificationEmail } from "./email.js";
import { securitySummary } from "./protect.js";
import { scoreboardLines, healthLines, isTest } from "./health.js";

// Weekday morning brief, sent by the Worker's own cron trigger. Plain data
// from D1, no model call and no mailbox access -- so it costs nothing to run
// and can't break when a connector does.

const TZ = "America/New_York";

function easternLabel(date, opts) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).format(date);
}

const FORM_NAMES = { "/api/leads": "Contact form", "/api/feedback": "Report-a-problem form" };
const BLOCK_NAMES = {
  honeypot: "bot filled the hidden field",
  too_fast: "submitted faster than a person can type",
  rate_limited: "too many from one address (got \"slow down\")",
  invalid_email: "bad email address",
  invalid_phone: "bad phone number",
};

function protectionLines(rows) {
  const accepted = rows.filter((r) => r.kind === "accepted").reduce((n, r) => n + r.n, 0);
  const blocked = rows.filter((r) => r.kind !== "accepted");
  const total = blocked.reduce((n, r) => n + r.n, 0);
  return [
    `SITE PROTECTION`,
    `- Real submissions let through: ${accepted}`,
    `- Stopped: ${total}${total ? "" : " (quiet)"}`,
    ...blocked.map((r) => `  - ${r.n} on the ${FORM_NAMES[r.path] || r.path}: ${BLOCK_NAMES[r.kind] || r.kind}`),
  ];
}

function leadLine(l) {
  const when = easternLabel(new Date(l.created_at), { weekday: "short", hour: "numeric", minute: "2-digit" });
  const msg = (l.pain || "").trim();
  return `- ${l.name} (${l.business}) -- ${l.contact}${l.phone ? ` / ${l.phone}` : ""} -- ${when}\n  ${msg ? `"${msg.slice(0, 160)}"` : "(no message)"}\n  ${l.triage_note || ""}`;
}

// Briefs go out at 8 AM and 8 PM Eastern. Cron runs in UTC, so wrangler.toml
// fires at both possible UTC hours and this keeps only the one that lands on
// 8 o'clock Eastern, whether or not daylight time is in effect.
export function isBriefHour(date = new Date()) {
  const hour = Number(easternLabel(date, { hour: "numeric", hourCycle: "h23" }));
  return hour === 8 || hour === 20;
}

export async function sendDailyBrief(env) {
  const now = new Date();
  const isMorning = Number(easternLabel(now, { hour: "numeric", hourCycle: "h23" })) < 12;
  const since = new Date(now.getTime() - 12 * 3600000).toISOString();

  const [leads, contracts, clients, payments, security] = await Promise.all([
    listLeads(env.DB, 500), listContracts(env.DB, 500), listClients(env.DB, 500), listPayments(env.DB, 500),
    securitySummary(env, since).catch(() => []),
  ]);
  const newLeads = leads.filter((l) => (l.created_at || "") >= since && !isTest(l));
  const needYou = newLeads;
  const pending = contracts.filter((c) => c.status === "pending_payment");
  const newContracts = contracts.filter((c) => (c.created_at || "") >= since);
  const failed = payments.filter((p) => (p.occurred_at || "") >= since && p.status === "failed");
  const active = clients.filter((c) => c.status === "active");
  const health = await healthLines(env, leads, now);

  const lines = [
    `${isMorning ? "Good morning" : "Good evening"}. Here's what happened at Minutes Regained in the last 12 hours.`,
    ``,
    `NEEDS YOU (${needYou.length + failed.length})`,
    ...(needYou.length || failed.length ? [] : ["Nothing right now."]),
    ...needYou.map(leadLine),
    ...failed.map((p) => `- Failed payment: ${p.amount_cents / 100} ${p.currency || ""} (contract ${p.contract_id})`),
    ``,
    `MONEY`,
    `- New agreements signed: ${newContracts.length}`,
    `- Agreements waiting on payment: ${pending.length}`,
    `- Active clients: ${active.length}`,
    ``,
    ...(isMorning ? [...scoreboardLines(leads, contracts, clients, now), ``] : []),
    ...health.lines,
    ``,
    ...protectionLines(security),
    ``,

    `Full details: https://minutesregained.com/api/admin/dashboard`,
    ``,
    `Sent automatically by minutesregained.com every day at 8 AM and 8 PM Eastern.`,
  ];

  await sendNotificationEmail(env, {
    subject: `${isMorning ? "Morning" : "Evening"} brief: ${easternLabel(now, { weekday: "long", month: "short", day: "numeric" })}${needYou.length ? ` -- ${needYou.length} need${needYou.length === 1 ? "s" : ""} you` : ""}${health.problems ? " -- SYSTEM CHECK NEEDED" : ""}`,
    text: lines.join("\n"),
  });
}
