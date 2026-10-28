// Two pages a client shares or keeps on their phone, both served from here:
//
//   /f/<slug>    Intake form for leads that come from social media. The owner
//                puts the link in a bio, a message auto-reply or a post. Each
//                request lands in their lead list, gets an acknowledgement and
//                goes through the same checks as email (emergencies included).
//   /v/<token>   Voice notes. The owner taps record, talks about the job, and
//                gets written job notes, estimate lines and a follow-up draft
//                by email. Speech-to-text runs on Cloudflare Workers AI.
//
// Nothing here sends anything to a customer except the fixed acknowledgement.

import { draftForClient, voiceNoteForClient, logClientAgentEvent, ensureClientAgentTables, outsideBusinessHours, afterHoursHoldingText } from "./clientagent.js";
import { sendNotificationEmail } from "./email.js";
import { afterVoiceNote } from "./usage.js";
import { screenSubmission, logSecurityEvent } from "./protect.js";

const STT_MODEL = "@cf/openai/whisper-large-v3-turbo";
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;   // about 10 minutes of phone audio
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha256 = async (s) => b64url(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (s, n) => String(s ?? "").trim().slice(0, n);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

let tablesReady = false;
async function ensureTables(env) {
  if (tablesReady) return;
  await ensureClientAgentTables(env);
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS client_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT NOT NULL, name TEXT, phone TEXT, email TEXT,
      address TEXT, message TEXT, source TEXT, created_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS voice_links (
      token_hash TEXT PRIMARY KEY, agent_id TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active')`),
  ]);
  tablesReady = true;
}

function page(title, bodyHtml, { script, mic } = {}) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex">
<style>body{margin:0;background:#F2F4F3;color:#10202E;font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:480px;margin:0 auto;padding:32px 20px 48px}h1{font-size:1.5rem;line-height:1.25;margin:0 0 8px}p{margin:0 0 14px}
label{display:block;font-weight:600;margin:14px 0 6px}input,textarea,select{width:100%;box-sizing:border-box;font:inherit;padding:12px;border:1px solid #C9D2D6;border-radius:10px;background:#fff}
textarea{min-height:120px}button{display:block;width:100%;margin-top:20px;border:0;border-radius:10px;padding:16px;font:600 1.05rem system-ui,sans-serif;background:#10202E;color:#fff;cursor:pointer}
button:disabled{opacity:.55}.rec{background:#C2500F}.rec.on{background:#B3261E}.small{color:#51606C;font-size:.9rem}.mark{font-weight:700;color:#C2500F}
.hp{position:absolute;left:-9999px;height:0;overflow:hidden}.status{margin-top:16px;font-weight:600}.err{color:#B3261E}</style></head>
<body><main>${bodyHtml}</main>${script ? `<script src="${script}"></script>` : ""}</body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; style-src 'unsafe-inline'; media-src blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Permissions-Policy": mic ? "microphone=(self), camera=(), geolocation=()" : "microphone=(), camera=(), geolocation=()",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}

const notFound = () => page("Not found", `<h1>This link isn't active.</h1><p class="small">Check the link with the business, or try again later.</p>`);

async function agentBySlug(env, slug) {
  if (!/^[a-z0-9-]{3,40}$/.test(slug || "")) return null;
  const { results } = await env.DB.prepare(`SELECT * FROM client_agents WHERE status = 'active'`).all();
  return (results || []).find((a) => JSON.parse(a.profile || "{}").formSlug === slug) || null;
}

async function ownerEmail(env, agent, profile) {
  if (profile.ownerEmail) return profile.ownerEmail;
  const conn = await env.DB.prepare(`SELECT email FROM client_connections WHERE agent_id = ? AND status = 'active' ORDER BY connected_at DESC LIMIT 1`)
    .bind(agent.id).first().catch(() => null);
  return (conn && conn.email) || env.NOTIFY_EMAIL;
}

// ------------------------------------------------------------ intake form --

export async function intakePage(env, slug, url) {
  await ensureTables(env);
  const agent = await agentBySlug(env, slug);
  if (!agent) return notFound();
  const p = JSON.parse(agent.profile || "{}");
  const src = clamp(url.searchParams.get("src"), 20).replace(/[^a-z]/gi, "").toLowerCase();
  return page(`Request service: ${p.business || "Request service"}`, `
<p class="mark">${esc(p.business || "Request service")}</p>
<h1>Tell us what you need</h1>
<p class="small">We'll get back to you as soon as we can.</p>
<form id="intake" data-slug="${esc(slug)}" data-src="${esc(src)}" novalidate>
  <label for="f-name">Your name</label><input id="f-name" name="name" autocomplete="name" required maxlength="120">
  <label for="f-phone">Phone</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" maxlength="40">
  <label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" maxlength="160">
  <label for="f-address">Service address</label><input id="f-address" name="address" autocomplete="street-address" maxlength="200">
  <label for="f-message">What do you need?</label><textarea id="f-message" name="message" required maxlength="2000"></textarea>
  <div class="hp" aria-hidden="true"><label for="f-web">Website</label><input id="f-web" name="company_website" tabindex="-1" autocomplete="off"></div>
  <button type="submit">Send request</button>
  <p class="status" id="f-status" role="status" aria-live="polite"></p>
  <p class="small">Your details go only to ${esc(p.business || "this business")}. Please give a phone number or an email so they can reach you.</p>
</form>`, { script: "/intake.js?v=1" });
}

export async function handleIntake(request, env, slug, ctx) {
  await ensureTables(env);
  const agent = await agentBySlug(env, slug);
  if (!agent) return json({ error: "not_found" }, 404);
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const path = `/api/intake/${slug}`;
  const screen = await screenSubmission(request, env, path, { honeypot: body.company_website, elapsedMs: body.elapsed_ms });
  if (!screen.ok) return screen.silent ? json({ ok: true }) : json({ error: "too_many_requests" }, 429);
  const lead = {
    name: clamp(body.name, 120), phone: clamp(body.phone, 40), email: clamp(body.email, 160).toLowerCase(),
    address: clamp(body.address, 200), message: clamp(body.message, 2000), source: clamp(body.src, 20) || "social",
  };
  if (!lead.name || !lead.message) return json({ error: "missing_fields" }, 400);
  if (!lead.phone && !lead.email) return json({ error: "need_phone_or_email" }, 400);
  if (lead.email && !EMAIL_RE.test(lead.email)) return json({ error: "invalid_email" }, 400);
  if (lead.phone && lead.phone.replace(/\D/g, "").length < 7) return json({ error: "invalid_phone" }, 400);
  await logSecurityEvent(env, { kind: "accepted", path, hash: screen.hash });
  await env.DB.prepare(`INSERT INTO client_leads (agent_id, name, phone, email, address, message, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(agent.id, lead.name, lead.phone, lead.email, lead.address, lead.message, lead.source, new Date().toISOString()).run();
  ctx.waitUntil(processIntake(env, agent, lead).catch((err) => console.error("intake processing failed", err)));
  return json({ ok: true });
}

async function processIntake(env, agent, lead) {
  const profile = JSON.parse(agent.profile || "{}");
  const business = profile.business || "the business";
  const details = [`Name: ${lead.name}`, `Phone: ${lead.phone || "(none)"}`, `Email: ${lead.email || "(none)"}`,
    `Address: ${lead.address || "(none)"}`, `Came from: ${lead.source}`, ``, lead.message].join("\n");
  let out;
  try {
    out = await draftForClient(env, agent, {
      from: lead.email ? `${lead.name} <${lead.email}>` : lead.name,
      subject: `Service request from ${lead.source}`,
      body: details,
    });
  } catch (err) {
    console.error("intake draft failed", err);
    out = { action: "handoff", reason: "Drafting failed; this one needs you." };
  }
  await logClientAgentEvent(env, agent.id, "form_lead", `${lead.name} via ${lead.source} form${out.emergency ? " (EMERGENCY)" : ""}.`);

  // The one message that goes to the customer: a fixed acknowledgement.
  let ack = null;
  if (lead.email) {
    const owner = await ownerEmail(env, agent, profile);
    ack = out.emergency && outsideBusinessHours(profile)
      ? afterHoursHoldingText(profile, out.routedTo)
      : `Thank you for contacting ${business.replace(/\.$/, "")}. We received your request and will be in touch soon.\n\n-- ${business}'s assistant (sent automatically)`;
    await sendNotificationEmail(env, {
      to: lead.email, fromName: `${business} (assistant)`, replyTo: owner,
      subject: `We received your request`, text: ack,
    }).catch((err) => { console.error("intake acknowledgement failed", err); ack = null; });
  }

  const owner = await ownerEmail(env, agent, profile);
  const suggested = out.action === "draft" ? out.draft : out.holding || "";
  await sendNotificationEmail(env, {
    to: owner,
    replyTo: lead.email || "support@minutesregained.com",
    subject: `${out.emergency ? "Emergency" : "New request"} from your ${lead.source} link: ${lead.name}`,
    text: [
      out.emergency ? (out.routedTo && out.routedTo.length ? `EMERGENCY. Sent to ${out.routedTo.join(", ")} (on call) right away.` : "EMERGENCY. Nobody is on call right now, so this needs you.") : null,
      out.reason || null,
      ``, details, ``,
      ack ? `They were sent this automatically:\n${ack}` : "No acknowledgement was sent (no email given).",
      suggested ? `\nSuggested reply (NOT sent; edit and send it yourself):\n${suggested}` : null,
      ``, `-- Minutes Regained, for ${business}`,
    ].filter((l) => l !== null).join("\n"),
  }).catch((err) => console.error("intake owner alert failed", err));
}

// ------------------------------------------------------------ voice notes --

export async function createVoiceLink(env, agentId) {
  await ensureTables(env);
  const token = b64url(crypto.getRandomValues(new Uint8Array(24)));
  await env.DB.prepare(`INSERT INTO voice_links (token_hash, agent_id, created_at) VALUES (?, ?, ?)`)
    .bind(await sha256(token), agentId, new Date().toISOString()).run();
  return token;
}

async function agentByVoiceToken(env, token) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token || "")) return null;
  const row = await env.DB.prepare(`SELECT a.* FROM voice_links v JOIN client_agents a ON a.id = v.agent_id
    WHERE v.token_hash = ? AND v.status = 'active' AND a.status = 'active'`).bind(await sha256(token)).first();
  return row || null;
}

export async function voicePage(env, token) {
  await ensureTables(env);
  const agent = await agentByVoiceToken(env, token);
  if (!agent) return notFound();
  const p = JSON.parse(agent.profile || "{}");
  return page("Voice note", `
<p class="mark">${esc(p.business || "Minutes Regained")}</p>
<h1>Talk about the job</h1>
<p class="small">Who, where, what you did, parts used, prices you quoted, and what's left to do. You'll get written notes and a draft follow-up by email.</p>
<div id="voice" data-token="${esc(token)}">
  <button type="button" class="rec" id="v-rec">Tap to record</button>
  <label for="v-file">Or send a recording you already made</label>
  <input id="v-file" type="file" accept="audio/*">
  <p class="status" id="v-status" role="status" aria-live="polite"></p>
</div>
<p class="small">Tip: add this page to your home screen so it's one tap away. Nothing is sent to your customers.</p>`, { script: "/voice.js?v=1", mic: true });
}

export async function handleVoice(request, env, token, ctx) {
  await ensureTables(env);
  const agent = await agentByVoiceToken(env, token);
  if (!agent) return json({ error: "not_found" }, 404);
  const audio = await request.arrayBuffer();
  if (audio.byteLength < 2000) return json({ error: "too_short" }, 400);
  if (audio.byteLength > MAX_AUDIO_BYTES) return json({ error: "too_long" }, 413);
  if (!env.AI) return json({ error: "not_configured" }, 503);
  ctx.waitUntil(processVoice(env, agent, audio).catch(async (err) => {
    console.error("voice note failed", err);
    await logClientAgentEvent(env, agent.id, "needs_you", "A voice note could not be processed.");
  }));
  return json({ ok: true });
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function transcribe(env, audio) {
  const r = await env.AI.run(STT_MODEL, { audio: toBase64(audio), vad_filter: true });
  return String((r && (r.text || (r.transcription_info && r.transcription_info.text))) || "").trim();
}

async function processVoice(env, agent, audio) {
  const profile = JSON.parse(agent.profile || "{}");
  const owner = await ownerEmail(env, agent, profile);
  const transcript = await transcribe(env, audio);
  if (!transcript) {
    await sendNotificationEmail(env, { to: owner, subject: "Voice note: we couldn't hear anything", text: "Your recording came through, but no speech could be picked up. Try again a little closer to the phone.\n\n-- Minutes Regained" });
    return;
  }
  const note = await voiceNoteForClient(env, agent, transcript);
  const sections = note ? [
    `JOB NOTES\n${note.job_notes || ""}`,
    note.estimate_notes ? `ESTIMATE / INVOICE LINES (check every price)\n${note.estimate_notes}` : null,
    note.to_do ? `TO DO\n${note.to_do}` : null,
    note.follow_up_draft ? `DRAFT FOLLOW-UP TO THE CUSTOMER (not sent; edit and send it yourself)\n${note.follow_up_draft}` : null,
  ] : ["Your daily limit for written-up notes was reached, so here is the transcript only."];
  await sendNotificationEmail(env, {
    to: owner,
    replyTo: "support@minutesregained.com",
    subject: `Voice note: ${(note && note.title) || transcript.slice(0, 60)}`,
    text: [...sections.filter(Boolean), `WHAT YOU SAID\n${transcript}`, `[GAP] marks anything you didn't say. Nothing here was sent to a customer.\n\n-- Minutes Regained, for ${profile.business || "your business"}`].join("\n\n"),
  });
  await logClientAgentEvent(env, agent.id, "voice_note", `Voice note written up: ${(note && note.title) || "transcript only"}.`);
  await afterVoiceNote(env, agent, profile, owner);
}

// ------------------------------------------------------------------ admin --

// Gives a client their intake form address and a voice-note link.
export async function createClientLinks(env, origin, { agentId, formSlug, ownerEmail: oe, clientId, plan, billing }) {
  await ensureTables(env);
  const agent = await env.DB.prepare(`SELECT * FROM client_agents WHERE id = ?`).bind(agentId).first();
  if (!agent) return { error: "agent_not_found" };
  const profile = JSON.parse(agent.profile || "{}");
  if (formSlug) {
    if (!/^[a-z0-9-]{3,40}$/.test(formSlug)) return { error: "bad_slug", rule: "3-40 lowercase letters, numbers or dashes" };
    const taken = await agentBySlug(env, formSlug);
    if (taken && taken.id !== agentId) return { error: "slug_taken" };
    profile.formSlug = formSlug;
  }
  if (oe) profile.ownerEmail = oe;
  // Ties the agent to its paying client, for the voice-note allowance and billing.
  if (clientId) profile.clientId = clientId;
  if (plan) profile.plan = plan;
  if (billing) profile.billing = billing;
  await env.DB.prepare(`UPDATE client_agents SET profile = ? WHERE id = ?`).bind(JSON.stringify(profile), agentId).run();
  const token = await createVoiceLink(env, agentId);
  return {
    formUrl: profile.formSlug ? `${origin}/f/${profile.formSlug}` : null,
    formUrlExamples: profile.formSlug ? ["instagram", "facebook", "tiktok"].map((s) => `${origin}/f/${profile.formSlug}?src=${s}`) : [],
    voiceUrl: `${origin}/v/${token}`,
    note: "The voice link works like a key. Send it only to the owner. Making a new one leaves the old one working.",
  };
}
