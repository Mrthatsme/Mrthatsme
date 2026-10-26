// One-link email connection for clients (Google and Microsoft).
//
// The owner taps an invite link, picks Gmail or Outlook, signs in and taps
// Allow. We keep an encrypted refresh token for that one mailbox, and every
// 10 minutes read new mail, ask draftForClient for a draft, and save it in the
// owner's own Drafts folder. No code path here sends, forwards or deletes.
// Microsoft is asked for Mail.ReadWrite only (no Mail.Send), so it cannot send
// even by mistake; Google has no draft-only permission, so there the fence is
// that this file never calls a send endpoint.

import { createClientAgent, draftForClient, logClientAgentEvent, ensureClientAgentTables } from "./clientagent.js";
import { sendNotificationEmail } from "./email.js";

// A customer cancelling or rescheduling is time-critical: the owner gets an
// alert in their own inbox right away, with a holding reply ready to send.
async function alertOwner(env, conn, profile, from, subject, out) {
  await sendNotificationEmail(env, {
    to: conn.email,
    replyTo: "support@minutesregained.com",
    subject: `Needs you now: ${from.replace(/<.*>/, "").trim() || "a customer"} wants to cancel or change something`,
    text: `${out.reason || ""}\n\nTheir email: "${subject}"\n\nNothing has been confirmed, cancelled or changed. A short holding reply is waiting in your Drafts; check it, send it, then decide.\n\n-- Minutes Regained, for ${profile.business || "your business"}`,
  }).catch((err) => console.error("owner alert failed", err));
}

const PROVIDERS = {
  google: {
    name: "Gmail / Google Workspace",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email https://www.googleapis.com/auth/gmail.modify",
    idKey: "GOOGLE_CLIENT_ID",
    secretKey: "GOOGLE_CLIENT_SECRET",
    extraAuth: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  microsoft: {
    name: "Outlook / Microsoft 365",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "openid email offline_access User.Read Mail.ReadWrite",
    idKey: "MICROSOFT_CLIENT_ID",
    secretKey: "MICROSOFT_CLIENT_SECRET",
    extraAuth: { prompt: "select_account" },
  },
};

const LABELS = { draft: "MR/Draft-Ready", needsYou: "MR/Needs-You", urgent: "MR/Urgent" };
const INVITE_DAYS = 14;
const MAX_PER_RUN = 10;

let tablesReady = false;
async function ensureTables(env) {
  if (tablesReady) return;
  await ensureClientAgentTables(env);
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS connect_invites (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, agent_id TEXT NOT NULL,
      expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY, invite_id TEXT NOT NULL, provider TEXT NOT NULL,
      verifier TEXT NOT NULL, created_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS client_connections (
      id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, provider TEXT NOT NULL, email TEXT,
      enc_refresh_token TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
      connected_at TEXT NOT NULL, last_poll TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS processed_messages (
      connection_id TEXT NOT NULL, message_id TEXT NOT NULL, processed_at TEXT NOT NULL,
      PRIMARY KEY (connection_id, message_id))`),
  ]);
  tablesReady = true;
}

// ---------------------------------------------------------------- crypto --

const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const randomToken = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (s) => b64url(await crypto.subtle.digest("SHA-256", enc.encode(s)));

async function tokenKey(env) {
  if (!env.TOKEN_ENC_KEY || env.TOKEN_ENC_KEY.length < 32) throw new Error("TOKEN_ENC_KEY is not set");
  const base = await crypto.subtle.importKey("raw", enc.encode(env.TOKEN_ENC_KEY), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("minutesregained-connect"), info: enc.encode("refresh-tokens-v1") },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

async function seal(env, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await tokenKey(env), enc.encode(plain));
  return `${b64url(iv)}.${b64url(ct)}`;
}

async function unseal(env, sealed) {
  const [iv, ct] = sealed.split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64url(iv) }, await tokenKey(env), fromB64url(ct));
  return new TextDecoder().decode(pt);
}

// ----------------------------------------------------------------- pages --

function page(title, bodyHtml, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><meta name="robots" content="noindex">
<style>body{margin:0;background:#F2F4F3;color:#10202E;font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:480px;margin:0 auto;padding:40px 20px}h1{font-size:1.5rem;margin:0 0 12px}p{margin:0 0 14px}
.btn{display:block;text-align:center;background:#10202E;color:#fff;text-decoration:none;font-weight:600;padding:16px;border-radius:10px;margin:12px 0}
.btn.ms{background:#C2500F}.small{color:#51606C;font-size:.9rem}.mark{font-weight:700;color:#C2500F}</style></head>
<body><main><p class="mark">Minutes Regained</p>${bodyHtml}</main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    },
  });
}

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// --------------------------------------------------------------- invites --

// Admin: one link per client. Creates the client's agent if needed.
export async function createConnectInvite(env, origin, { agentId, label, profile, dailyCap }) {
  await ensureTables(env);
  let id = agentId;
  if (!id) id = (await createClientAgent(env, { label, profile, dailyCap })).id;
  const token = randomToken(24);
  const inviteId = "inv_" + randomToken(6);
  const now = new Date();
  await env.DB.prepare(`INSERT INTO connect_invites (id, token_hash, agent_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(inviteId, await sha256(token), id, new Date(now.getTime() + INVITE_DAYS * 86400000).toISOString(), now.toISOString()).run();
  return { agentId: id, url: `${origin}/api/connect?i=${token}`, expires: `${INVITE_DAYS} days` };
}

async function findInvite(env, token) {
  if (!token) return null;
  const inv = await env.DB.prepare(`SELECT * FROM connect_invites WHERE token_hash = ?`).bind(await sha256(token)).first();
  if (!inv || inv.used_at || inv.expires_at < new Date().toISOString()) return null;
  return inv;
}

const expired = () => page("Link expired", `<h1>This link has expired or was already used</h1><p>Email <b>support@minutesregained.com</b> and we'll send you a fresh one.</p>`, 410);

// GET /api/connect?i=... : the owner picks their email provider.
export async function connectLanding(env, url) {
  await ensureTables(env);
  const token = url.searchParams.get("i");
  if (!(await findInvite(env, token))) return expired();
  const link = (p) => `/api/connect/start?i=${encodeURIComponent(token)}&p=${p}`;
  // Only providers whose app settings are in place get a button.
  const ready = (p) => env[PROVIDERS[p].idKey] && env[PROVIDERS[p].secretKey];
  const buttons = [
    ready("google") ? `<a class="btn" href="${link("google")}">Gmail or Google Workspace</a>` : "",
    ready("microsoft") ? `<a class="btn ms" href="${link("microsoft")}">Outlook or Microsoft 365</a>` : "",
  ].join("");
  if (!buttons) {
    return page("Not ready yet", `<h1>Not ready yet</h1><p>This connection isn't switched on yet. Please email support@minutesregained.com.</p>`, 503);
  }
  return page("Connect your email", `<h1>Connect your email</h1>
<p>Tap the one you use for your business. You'll sign in as usual and tap <b>Allow</b>. That's it.</p>
${buttons}
<p class="small">We read new email and save reply drafts in your Drafts folder. We never send, forward or delete anything; you send every reply yourself. You can disconnect any time from your Google or Microsoft account.</p>`);
}

// GET /api/connect/start?i=...&p=google|microsoft : off to the provider.
export async function connectStart(env, url) {
  await ensureTables(env);
  const provider = PROVIDERS[url.searchParams.get("p")];
  const inv = await findInvite(env, url.searchParams.get("i"));
  if (!inv || !provider) return expired();
  if (!env[provider.idKey] || !env[provider.secretKey]) {
    return page("Not ready yet", `<h1>Not ready yet</h1><p>This connection isn't switched on yet. Please email support@minutesregained.com.</p>`, 503);
  }
  const state = randomToken(24), verifier = randomToken(48);
  await env.DB.prepare(`INSERT INTO oauth_states (state, invite_id, provider, verifier, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(state, inv.id, url.searchParams.get("p"), verifier, new Date().toISOString()).run();
  const params = new URLSearchParams({
    client_id: env[provider.idKey],
    redirect_uri: `${url.origin}/api/connect/${url.searchParams.get("p")}/callback`,
    response_type: "code",
    scope: provider.scope,
    state,
    code_challenge: await sha256(verifier),
    code_challenge_method: "S256",
    ...provider.extraAuth,
  });
  return Response.redirect(`${provider.authUrl}?${params}`, 302);
}

// GET /api/connect/<provider>/callback : save the connection.
export async function connectCallback(env, url, providerId) {
  await ensureTables(env);
  const provider = PROVIDERS[providerId];
  const state = url.searchParams.get("state");
  const row = state && await env.DB.prepare(`SELECT * FROM oauth_states WHERE state = ? AND provider = ?`).bind(state, providerId).first();
  if (state) await env.DB.prepare(`DELETE FROM oauth_states WHERE state = ? OR created_at < ?`).bind(state, new Date(Date.now() - 900000).toISOString()).run();
  if (!provider || !row || row.created_at < new Date(Date.now() - 900000).toISOString()) return expired();
  if (url.searchParams.get("error")) {
    return page("Not connected", `<h1>Not connected</h1><p>Nothing was changed. If that wasn't intended, tap the link in your email again.</p>`, 400);
  }
  const inv = await env.DB.prepare(`SELECT * FROM connect_invites WHERE id = ?`).bind(row.invite_id).first();
  if (!inv || inv.used_at) return expired();

  const tokenRes = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env[provider.idKey], client_secret: env[provider.secretKey],
      code: url.searchParams.get("code") || "", code_verifier: row.verifier,
      grant_type: "authorization_code", redirect_uri: `${url.origin}/api/connect/${providerId}/callback`,
    }),
  });
  const tok = await tokenRes.json();
  if (!tokenRes.ok || !tok.refresh_token) {
    console.error("token exchange failed", tokenRes.status, tok.error);
    return page("Not connected", `<h1>Something went wrong</h1><p>Nothing was saved. Please email support@minutesregained.com and we'll sort it out.</p>`, 502);
  }
  const email = await accountEmail(providerId, tok);
  const id = "con_" + randomToken(6);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO client_connections (id, agent_id, provider, email, enc_refresh_token, connected_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, inv.agent_id, providerId, email, await seal(env, tok.refresh_token), new Date().toISOString()),
    env.DB.prepare(`UPDATE connect_invites SET used_at = ? WHERE id = ?`).bind(new Date().toISOString(), inv.id),
  ]);
  await logClientAgentEvent(env, inv.agent_id, "connected", `${provider.name} connected: ${email}`);
  return page("Connected", `<h1>You're connected</h1>
<p><b>${escapeHtml(email)}</b> is connected. From now on, replies to new customer email appear as drafts in your Drafts folder for you to check and send.</p>
<p class="small">We never send, forward or delete anything. To disconnect, remove "Minutes Regained" from your ${providerId === "google" ? "Google Account (Security > Third-party connections)" : "Microsoft account (My Apps or Privacy > Apps and services)"}.</p>
<p>You can close this page.</p>`);
}

async function accountEmail(providerId, tok) {
  if (providerId === "google" && tok.id_token) {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(tok.id_token.split(".")[1])));
    return payload.email || "";
  }
  const me = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", { headers: { Authorization: `Bearer ${tok.access_token}` } });
  const j = await me.json();
  return j.mail || j.userPrincipalName || "";
}

// ------------------------------------------------------------------ poll --

async function accessToken(env, conn) {
  const provider = PROVIDERS[conn.provider];
  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env[provider.idKey], client_secret: env[provider.secretKey],
      refresh_token: await unseal(env, conn.enc_refresh_token), grant_type: "refresh_token",
      ...(conn.provider === "microsoft" ? { scope: provider.scope } : {}),
    }),
  });
  const tok = await res.json();
  if (!res.ok) {
    const err = new Error(tok.error || `token refresh ${res.status}`);
    err.revoked = tok.error === "invalid_grant";
    throw err;
  }
  if (tok.refresh_token) {   // Microsoft rotates refresh tokens
    await env.DB.prepare(`UPDATE client_connections SET enc_refresh_token = ? WHERE id = ?`).bind(await seal(env, tok.refresh_token), conn.id).run();
  }
  return tok.access_token;
}

const subjectAllowed = (profile, subject) => !profile.onlySubjectsContaining || String(subject || "").includes(profile.onlySubjectsContaining);

export async function pollConnectedInboxes(env) {
  await ensureTables(env);
  const { results } = await env.DB.prepare(
    `SELECT c.*, a.profile, a.daily_cap, a.label FROM client_connections c JOIN client_agents a ON a.id = c.agent_id
     WHERE c.status = 'active' AND a.status = 'active'`
  ).all();
  for (const conn of results || []) {
    try {
      const token = await accessToken(env, conn);
      const handled = conn.provider === "google" ? await pollGmail(env, conn, token) : await pollOutlook(env, conn, token);
      await env.DB.batch([
        env.DB.prepare(`UPDATE client_connections SET last_poll = ? WHERE id = ?`).bind(new Date().toISOString(), conn.id),
        env.DB.prepare(`UPDATE client_agents SET last_seen = ? WHERE id = ?`).bind(new Date().toISOString(), conn.agent_id),
      ]);
      if (handled) console.log(`${conn.label}: handled ${handled}`);
    } catch (err) {
      console.error("poll failed", conn.id, err.message);
      if (err.revoked) {
        await env.DB.prepare(`UPDATE client_connections SET status = 'disconnected' WHERE id = ?`).bind(conn.id).run();
        await logClientAgentEvent(env, conn.agent_id, "needs_you", `${conn.email} was disconnected (access removed or expired). Send a new connect link if that wasn't intended.`);
      }
    }
  }
}

async function alreadyDone(env, conn, id) {
  return !!(await env.DB.prepare(`SELECT 1 FROM processed_messages WHERE connection_id = ? AND message_id = ?`).bind(conn.id, id).first());
}
async function markDone(env, conn, id) {
  await env.DB.prepare(`INSERT OR IGNORE INTO processed_messages (connection_id, message_id, processed_at) VALUES (?, ?, ?)`)
    .bind(conn.id, id, new Date().toISOString()).run();
}
const sameAddress = (a, b) => String(a || "").toLowerCase().includes(String(b || "").toLowerCase()) && !!b;
const agentRow = (conn) => ({ id: conn.agent_id, profile: conn.profile, daily_cap: conn.daily_cap });

// --- Gmail ---

async function gmail(token, path, init = {}) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`gmail ${path.split("?")[0]} ${res.status}`);
  return res.json();
}

function gmailText(payload) {
  const walk = (p) => {
    if (!p) return "";
    if (p.mimeType === "text/plain" && p.body && p.body.data) return new TextDecoder().decode(fromB64url(p.body.data));
    for (const part of p.parts || []) { const t = walk(part); if (t) return t; }
    if (p.mimeType === "text/html" && p.body && p.body.data) return new TextDecoder().decode(fromB64url(p.body.data)).replace(/<[^>]+>/g, " ");
    return "";
  };
  return walk(payload);
}

async function gmailLabelIds(token) {
  const { labels = [] } = await gmail(token, "labels");
  const ids = {};
  for (const [k, name] of Object.entries(LABELS)) {
    const found = labels.find((l) => l.name === name);
    ids[k] = found ? found.id : (await gmail(token, "labels", { method: "POST", body: JSON.stringify({ name, labelListVisibility: "labelShow", messageListVisibility: "show" }) })).id;
  }
  return ids;
}

async function pollGmail(env, conn, token) {
  const profile = JSON.parse(conn.profile || "{}");
  const after = Math.floor(new Date(conn.connected_at).getTime() / 1000);
  let q = `in:inbox after:${after} -in:chats`;
  if (profile.onlySubjectsContaining) q += ` subject:"${profile.onlySubjectsContaining}"`;
  const list = await gmail(token, `messages?maxResults=${MAX_PER_RUN}&q=${encodeURIComponent(q)}`);
  let labelIds = null, handled = 0;
  for (const { id } of list.messages || []) {
    if (await alreadyDone(env, conn, id)) continue;
    const msg = await gmail(token, `messages/${id}?format=full`);
    const h = Object.fromEntries((msg.payload.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
    const from = h.from || "", subject = h.subject || "";
    if (sameAddress(from, conn.email) || h["list-unsubscribe"] || /no-?reply|mailer-daemon/i.test(from) || !subjectAllowed(profile, subject)) {
      await markDone(env, conn, id); continue;
    }
    const out = await draftForClient(env, agentRow(conn), { from, subject, body: gmailText(msg.payload) });
    labelIds = labelIds || await gmailLabelIds(token);
    const replyText = out.action === "draft" ? out.draft : out.urgent ? out.holding : null;
    if (replyText) {
      const raw = [
        `To: ${h["reply-to"] || from}`,
        `Subject: ${/^re:/i.test(subject) ? subject : "Re: " + subject}`,
        h["message-id"] ? `In-Reply-To: ${h["message-id"]}` : null,
        h["message-id"] ? `References: ${[h.references, h["message-id"]].filter(Boolean).join(" ")}` : null,
        `Content-Type: text/plain; charset="UTF-8"`,
        ``,
        replyText,
      ].filter((l) => l !== null).join("\r\n");
      await gmail(token, "drafts", { method: "POST", body: JSON.stringify({ message: { raw: b64url(enc.encode(raw)), threadId: msg.threadId } }) });
    }
    const add = out.action === "draft" ? [labelIds.draft] : out.action === "handoff" ? [labelIds.needsYou, ...(out.urgent ? [labelIds.urgent] : [])] : [];
    if (add.length) await gmail(token, `messages/${id}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds: add }) });
    if (out.urgent) await alertOwner(env, conn, profile, from, subject, out);
    await markDone(env, conn, id);
    handled++;
  }
  return handled;
}

// --- Outlook / Microsoft 365 ---

async function graph(token, path, init = {}) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: 'outlook.body-content-type="text"', ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`graph ${path.split("?")[0]} ${res.status}`);
  return res.status === 204 ? {} : res.json();
}

async function pollOutlook(env, conn, token) {
  const profile = JSON.parse(conn.profile || "{}");
  const since = new Date(conn.connected_at).toISOString();
  const list = await graph(token,
    `mailFolders/inbox/messages?$filter=receivedDateTime ge ${since}&$orderby=receivedDateTime desc&$top=${MAX_PER_RUN}&$select=id,subject,from,replyTo,body,categories,isDraft`);
  let handled = 0;
  for (const m of list.value || []) {
    if (m.isDraft || await alreadyDone(env, conn, m.id)) continue;
    const fromAddr = m.from && m.from.emailAddress ? m.from.emailAddress.address : "";
    const from = m.from && m.from.emailAddress ? `${m.from.emailAddress.name || ""} <${fromAddr}>` : "";
    if (sameAddress(fromAddr, conn.email) || /no-?reply|mailer-daemon/i.test(fromAddr) || !subjectAllowed(profile, m.subject)) {
      await markDone(env, conn, m.id); continue;
    }
    const out = await draftForClient(env, agentRow(conn), { from, subject: m.subject || "", body: (m.body && m.body.content) || "" });
    const cats = new Set(m.categories || []);
    const replyText = out.action === "draft" ? out.draft : out.urgent ? out.holding : null;
    if (replyText) {
      await graph(token, `messages/${m.id}/createReply`, { method: "POST", body: JSON.stringify({ comment: replyText }) }); // saved in Drafts, not sent
    }
    if (out.action === "draft") cats.add(LABELS.draft.replace("/", " "));
    if (out.action === "handoff") cats.add(LABELS.needsYou.replace("/", " "));
    if (out.urgent) { cats.add(LABELS.urgent.replace("/", " ")); await alertOwner(env, conn, profile, from, m.subject || "", out); }
    if (cats.size !== (m.categories || []).length) {
      await graph(token, `messages/${m.id}`, { method: "PATCH", body: JSON.stringify({ categories: [...cats] }) });
    }
    await markDone(env, conn, m.id);
    handled++;
  }
  return handled;
}
