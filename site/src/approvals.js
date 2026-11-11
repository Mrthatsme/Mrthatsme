// The owner's one-tap answers from the Daily Brief and the hours warning.
//
// GET /b/<token> shows what the link will do and a button; only POST acts, so a
// mail scanner opening the link changes nothing. Every answer is logged with
// its time and address, and Jerome is emailed.
//   hours yes  -> records the owner's approval for that extra time (hours.js)
//   hours no   -> declines; the build stays within the hours they have
//   done       -> marks a waiting item done, so it leaves their brief

import { readLink } from "./links.js";
import { recordApproval, fmtMinutes, extraCents } from "./hours.js";
import { PLANS } from "./plans.js";
import { sendNotificationEmail } from "./email.js";
import { monthKey } from "./usage.js";
import { setPaused, isPaused } from "./pause.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let ready = false;
export async function ensureDoneTable(env) {
  if (ready) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS owner_done (
    event_id INTEGER PRIMARY KEY, agent_id TEXT NOT NULL, done_at TEXT NOT NULL)`).run();
  ready = true;
}

function page(title, body, status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} | Minutes Regained</title>
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:2rem auto;padding:0 16px;color:#16211f;background:#fbf8f1;line-height:1.5}
h1{font-size:1.4rem}.box{background:#fff;border:1px solid #e3ddd0;border-radius:12px;padding:16px}
button{font:inherit;font-size:1rem;padding:12px 18px;border:0;border-radius:10px;background:#1f6466;color:#fff;cursor:pointer;width:100%;margin-top:12px}
button.no{background:#8a3b00}.small{font-size:.85rem;color:#555}</style></head><body><div class="box">${body}</div>
<p class="small">Minutes Regained · support@minutesregained.com · (877) 896-8784</p></body></html>`, {
    status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" },
  });
}

const gone = () => page("Link expired", `<h1>This link has expired or isn't valid</h1><p>Nothing was changed. Reply to your Daily Brief or email support@minutesregained.com and we'll sort it out.</p>`, 410);

async function describe(env, p) {
  const agent = await env.DB.prepare(`SELECT * FROM client_agents WHERE id = ?`).bind(p.ag).first();
  if (!agent) return null;
  const profile = JSON.parse(agent.profile || "{}");
  const business = profile.business || agent.label;
  if (p.t === "hours") {
    const req = await env.DB.prepare(`SELECT r.*, b.name AS build_name FROM hours_requests r LEFT JOIN builds b ON b.id = r.build_id WHERE r.id = ? AND r.agent_id = ?`).bind(p.id, p.ag).first();
    if (!req) return null;
    const hourly = (PLANS[profile.plan] || {}).extraHourly || 95;
    const cost = `$${(extraCents(req.minutes, hourly) / 100).toFixed(2)}`;
    return { agent, business, req, done: req.status !== "pending",
      question: p.a === "yes"
        ? `Approve up to ${fmtMinutes(req.minutes)} of extra time${req.build_name ? ` to finish ${req.build_name}` : ""}, at $${hourly} an hour (about ${cost})?`
        : `Decline the extra time${req.build_name ? ` for ${req.build_name}` : ""}? We'll pause it and pick it up with next month's hours.`,
      button: p.a === "yes" ? "Yes, approve it" : "No, pause it", cls: p.a === "yes" ? "" : "no" };
  }
  if (p.t === "pause") {
    const paused = isPaused(agent);
    const pausing = p.a === "pause";
    return { agent, business, done: pausing === paused,
      question: pausing
        ? `Pause everything for ${business}? Nothing will read your inbox, draft, route or send anything on its own until you resume. Requests through your form still come to you. Your fee and 30-day notice don't change.`
        : `Resume everything for ${business}? Your inbox is checked again within 10 minutes.`,
      button: pausing ? "Pause everything" : "Resume", cls: pausing ? "no" : "" };
  }
  if (p.t === "done") {
    const ev = await env.DB.prepare(`SELECT * FROM client_agent_events WHERE id = ? AND agent_id = ?`).bind(p.id, p.ag).first();
    if (!ev) return null;
    await ensureDoneTable(env);
    const done = await env.DB.prepare(`SELECT 1 FROM owner_done WHERE event_id = ?`).bind(p.id).first();
    return { agent, business, ev, done: !!done, question: `Mark this as handled? "${ev.summary.replace(/^\[[^\]]+\]\s*/, "")}"`, button: "Yes, it's done", cls: "" };
  }
  return null;
}

export async function linkPage(env, token) {
  const p = await readLink(env, token);
  if (!p) return gone();
  const d = await describe(env, p);
  if (!d) return gone();
  if (d.done) return page("Already answered", p.t === "pause" ? `<h1>Already ${p.a === "pause" ? "paused" : "running"}</h1><p>Nothing to change.</p>` : `<h1>Already answered</h1><p>This was already taken care of. Nothing more to do.</p>`);
  return page("Confirm", `<p class="small">${esc(d.business)}</p><h1>${esc(d.question)}</h1>
<form method="post"><button type="submit" class="${d.cls}">${esc(d.button)}</button></form>
<p class="small">Nothing happens until you tap the button.</p>`);
}

export async function linkAct(env, token, request) {
  const p = await readLink(env, token);
  if (!p) return gone();
  const d = await describe(env, p);
  if (!d) return gone();
  if (d.done) return page("Already answered", p.t === "pause" ? `<h1>Already ${p.a === "pause" ? "paused" : "running"}</h1><p>Nothing to change.</p>` : `<h1>Already answered</h1><p>This was already taken care of.</p>`);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = new Date();
  const stamp = `${now.toISOString()} from ${ip}`;

  if (p.t === "hours" && p.a === "yes") {
    if (d.req.month !== monthKey(now)) {
      await env.DB.prepare(`UPDATE hours_requests SET status = 'expired', decided_at = ? WHERE id = ?`).bind(now.toISOString(), d.req.id).run();
      return page("New month", `<h1>That request was for last month</h1><p>Your hours have reset, so nothing was approved. If the work still needs extra time, you'll get a new request.</p>`);
    }
    const r = await recordApproval(env, { agentId: p.ag, minutes: d.req.minutes, note: `Approved by the owner with the one-tap link, ${stamp}` }, now);
    if (r.error) return page("Not recorded", `<h1>That didn't go through</h1><p>Nothing was approved. Email support@minutesregained.com.</p>`, 400);
    await env.DB.prepare(`UPDATE hours_requests SET status = 'approved', decided_at = ?, decided_note = ? WHERE id = ?`).bind(now.toISOString(), stamp, d.req.id).run();
    await sendNotificationEmail(env, { subject: `[${d.agent.label}] approved ${fmtMinutes(d.req.minutes)} extra`, text: `${d.business} approved up to ${fmtMinutes(d.req.minutes)} of extra time with the one-tap link (${stamp}). It's recorded; you can log the time.` }).catch(() => {});
    return page("Approved", `<h1>Approved</h1><p>Up to ${esc(fmtMinutes(d.req.minutes))} of extra time is approved and recorded. Every minute shows on your monthly report.</p>`);
  }
  if (p.t === "hours" && p.a === "no") {
    await env.DB.prepare(`UPDATE hours_requests SET status = 'declined', decided_at = ?, decided_note = ? WHERE id = ?`).bind(now.toISOString(), stamp, d.req.id).run();
    await sendNotificationEmail(env, { subject: `[${d.agent.label}] declined extra time`, text: `${d.business} declined the extra time with the one-tap link (${stamp}). Keep the work within their hours and pick it up next month.` }).catch(() => {});
    return page("Paused", `<h1>Got it, paused</h1><p>We'll stay within your hours and pick it up with next month's. Nothing extra goes on your bill.</p>`);
  }
  if (p.t === "pause") {
    await setPaused(env, p.ag, p.a === "pause", `the owner, one-tap link, ${stamp}`);
    return p.a === "pause"
      ? page("Paused", `<h1>Everything is paused</h1><p>Nothing reads your inbox or sends anything on its own. Requests through your form still come to you. Resume any time from your Daily Brief.</p>`)
      : page("Resumed", `<h1>Resumed</h1><p>Everything runs again. Your inbox is checked within 10 minutes.</p>`);
  }
  if (p.t === "done") {
    await env.DB.prepare(`INSERT INTO owner_done (event_id, agent_id, done_at) VALUES (?, ?, ?) ON CONFLICT(event_id) DO NOTHING`).bind(p.id, p.ag, now.toISOString()).run();
    return page("Done", `<h1>Marked done</h1><p>It won't show in tomorrow's brief.</p>`);
  }
  return gone();
}

// For the Daily Brief: what's waiting on this owner, with one-tap links.
export async function openItems(env, agentId, makeLinkFn, now = new Date()) {
  await ensureDoneTable(env);
  const since = new Date(now.getTime() - 7 * 86400000).toISOString();
  const { results: waiting } = await env.DB.prepare(
    `SELECT e.id, e.summary FROM client_agent_events e LEFT JOIN owner_done d ON d.event_id = e.id
     WHERE e.agent_id = ? AND e.kind = 'needs_you' AND e.created_at >= ? AND d.event_id IS NULL ORDER BY e.id`
  ).bind(agentId, since).all();
  const { results: reqs } = await env.DB.prepare(
    `SELECT r.*, b.name AS build_name FROM hours_requests r LEFT JOIN builds b ON b.id = r.build_id
     WHERE r.agent_id = ? AND r.status = 'pending' AND r.month = ? ORDER BY r.id`
  ).bind(agentId, monthKey(now)).all().catch(() => ({ results: [] }));
  const items = [];
  for (const w of waiting || []) {
    items.push({ text: w.summary.replace(/^\[[^\]]+\]\s*/, ""), doneUrl: await makeLinkFn(env, { t: "done", id: w.id, ag: agentId }) });
  }
  const requests = [];
  for (const r of reqs || []) {
    requests.push({
      text: `Extra time${r.build_name ? ` for ${r.build_name}` : ""}: up to ${fmtMinutes(r.minutes)}.`,
      yesUrl: await makeLinkFn(env, { t: "hours", id: r.id, a: "yes", ag: agentId }),
      noUrl: await makeLinkFn(env, { t: "hours", id: r.id, a: "no", ag: agentId }),
    });
  }
  return { items, requests };
}
