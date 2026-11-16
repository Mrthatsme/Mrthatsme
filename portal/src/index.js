// Minutes Regained client portal — Cloudflare Worker.
// Serves /portal/* (static files from ./public) and /api/portal/* (this file).
// Runs on its own route, so the main site's Worker (leads, contracts, Stripe) is never touched.

export const STAGES = [
  { key: 'prospect', label: 'Intro', client: 'We got your request' },
  { key: 'call', label: 'Discovery call', client: 'Free 30-minute call' },
  { key: 'proposal', label: 'Proposal', client: 'Your written plan' },
  { key: 'agreement', label: 'Agreement + NDA', client: 'Agreement and NDA signed' },
  { key: 'setup', label: 'Setup', client: 'We build inside your accounts' },
  { key: 'read_only', label: 'Read-only', client: 'Two weeks read-only' },
  { key: 'live', label: 'Live', client: 'Live, your way' },
];
const STAGE_KEYS = STAGES.map((s) => s.key).concat(['paused', 'closed']);
const LEVELS = ['Do it', 'Tell me', 'Ask me', 'Never'];
const SESSION_DAYS = 30;
const INVITE_DAYS = 7;
const COOKIE = 'mr_portal';

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// ---------- helpers ----------
const now = () => new Date().toISOString();
const addDays = (d) => new Date(Date.now() + d * 864e5).toISOString();
const id = (p) => p + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

async function hashPassword(password, saltHex) {
  const salt = saltHex || hex(crypto.getRandomValues(new Uint8Array(16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256);
  return { hash: hex(bits), salt };
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });

const str = (v, max = 2000) => (v == null ? null : String(v).trim().slice(0, max) || null);
const num = (v) => (v === '' || v == null || isNaN(+v) ? null : +v);
const emailOk = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;

function withHeaders(res) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) r.headers.set(k, v);
  return r;
}

async function readJson(req) {
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new HttpError(415, 'Send JSON.');
  try { return await req.json(); } catch { throw new HttpError(400, 'Bad JSON.'); }
}

function cookieValue(req, name) {
  const c = req.headers.get('cookie') || '';
  const m = c.split(/;\s*/).find((p) => p.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
const sessionCookie = (token, maxAge) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

async function logActivity(db, accountId, actor, text) {
  await db.prepare('INSERT INTO activity (id, account_id, actor, text, created_at) VALUES (?,?,?,?,?)')
    .bind(id('act'), accountId, actor, text.slice(0, 500), now()).run();
}

async function newInvite(db, userId) {
  const token = randToken();
  await db.prepare('INSERT INTO invites (token_hash, user_id, expires_at, created_at) VALUES (?,?,?,?)')
    .bind(await sha256(token), userId, addDays(INVITE_DAYS), now()).run();
  return token;
}

// ---------- auth ----------
async function currentUser(req, env) {
  const token = cookieValue(req, COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.account_id, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`)
    .bind(await sha256(token)).first();
  if (!row || row.expires_at < now()) return null;
  return row;
}
async function requireUser(req, env, role) {
  const u = await currentUser(req, env);
  if (!u) throw new HttpError(401, 'Please sign in.');
  if (role && u.role !== role) throw new HttpError(403, 'Not allowed.');
  return u;
}

async function startSession(env, userId) {
  const token = randToken();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(userId, now()),
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?,?,?,?)')
      .bind(await sha256(token), userId, addDays(SESSION_DAYS), now()),
    env.DB.prepare('UPDATE users SET last_login_at = ?, failed_logins = 0, locked_until = NULL WHERE id = ?').bind(now(), userId),
  ]);
  return sessionCookie(token, SESSION_DAYS * 86400);
}

async function login(req, env) {
  const b = await readJson(req);
  const email = (str(b.email, 254) || '').toLowerCase();
  const password = String(b.password || '');
  const generic = new HttpError(401, "That email and password don't match. Try again, or ask us for a new setup link.");
  const u = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!u || !u.password_hash) { await hashPassword(password || 'x'); throw generic; }
  if (u.locked_until && u.locked_until > now()) throw new HttpError(429, 'Too many tries. Wait 15 minutes, or email support@minutesregained.com.');
  const { hash } = await hashPassword(password, u.password_salt);
  if (!safeEqual(hash, u.password_hash)) {
    const fails = (u.failed_logins || 0) + 1;
    await env.DB.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?')
      .bind(fails >= 5 ? 0 : fails, fails >= 5 ? new Date(Date.now() + 15 * 60e3).toISOString() : null, u.id).run();
    throw generic;
  }
  const cookie = await startSession(env, u.id);
  return json({ ok: true, role: u.role }, 200, { 'set-cookie': cookie });
}

async function logout(req, env) {
  const token = cookieValue(req, COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
}

async function checkInvite(env, token) {
  if (!/^[a-f0-9]{64}$/.test(token || '')) throw new HttpError(400, 'That setup link is not valid.');
  const inv = await env.DB.prepare(
    `SELECT i.*, u.email, u.name, u.role, a.business_name FROM invites i JOIN users u ON u.id = i.user_id LEFT JOIN accounts a ON a.id = u.account_id WHERE i.token_hash = ?`)
    .bind(await sha256(token)).first();
  if (!inv || inv.used_at || inv.expires_at < now()) throw new HttpError(410, 'That setup link has expired or was already used. Ask us for a new one.');
  return inv;
}

async function setupPassword(req, env) {
  const b = await readJson(req);
  const inv = await checkInvite(env, b.token);
  const pw = String(b.password || '');
  if (pw.length < 10) throw new HttpError(400, 'Use at least 10 characters.');
  if (pw.length > 200) throw new HttpError(400, 'That password is too long.');
  const { hash, salt } = await hashPassword(pw);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ?, failed_logins = 0, locked_until = NULL WHERE id = ?').bind(hash, salt, inv.user_id),
    env.DB.prepare('UPDATE invites SET used_at = ? WHERE token_hash = ?').bind(now(), inv.token_hash),
    env.DB.prepare('UPDATE invites SET used_at = ? WHERE user_id = ? AND used_at IS NULL').bind(now(), inv.user_id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(inv.user_id),
  ]);
  const u = await env.DB.prepare('SELECT account_id, role FROM users WHERE id = ?').bind(inv.user_id).first();
  if (u.account_id) await logActivity(env.DB, u.account_id, 'client', `${inv.email} set up their portal login`);
  const cookie = await startSession(env, inv.user_id);
  return json({ ok: true, role: u.role }, 200, { 'set-cookie': cookie });
}

async function changePassword(req, env, user) {
  const b = await readJson(req);
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  const cur = await hashPassword(String(b.current || ''), u.password_salt);
  if (!safeEqual(cur.hash, u.password_hash)) throw new HttpError(400, 'Your current password is not right.');
  const pw = String(b.password || '');
  if (pw.length < 10 || pw.length > 200) throw new HttpError(400, 'Use at least 10 characters.');
  const { hash, salt } = await hashPassword(pw);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, u.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id),
  ]);
  const cookie = await startSession(env, u.id);
  return json({ ok: true }, 200, { 'set-cookie': cookie });
}

// First admin only. Needs the SETUP_KEY secret; refuses once any admin exists.
async function bootstrap(req, env) {
  const key = req.headers.get('x-setup-key') || '';
  if (!env.SETUP_KEY || env.SETUP_KEY.length < 16 || !safeEqual(key, env.SETUP_KEY)) throw new HttpError(403, 'Not allowed.');
  const exists = await env.DB.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").first();
  if (exists) throw new HttpError(409, 'An admin already exists. Sign in at /portal.');
  const b = await readJson(req);
  const email = (str(b.email, 254) || '').toLowerCase();
  if (!emailOk(email)) throw new HttpError(400, 'Give a valid email.');
  const uid = id('usr');
  await env.DB.prepare("INSERT INTO users (id, account_id, email, name, role, created_at) VALUES (?, NULL, ?, ?, 'admin', ?)")
    .bind(uid, email, str(b.name, 100), now()).run();
  const token = await newInvite(env.DB, uid);
  return json({ ok: true, setup_url: new URL('/portal/setup?token=' + token, req.url).toString() });
}

// ---------- client data ----------
async function accountBundle(db, accountId, { internal = false } = {}) {
  const q = (sql) => db.prepare(sql).bind(accountId);
  const [account, approvals, reports, automations, requests, documents, invoices, activity, users, notes] = await Promise.all([
    q('SELECT * FROM accounts WHERE id = ?').first(),
    q("SELECT * FROM approvals WHERE account_id = ? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 100").all(),
    q('SELECT * FROM reports WHERE account_id = ? ORDER BY report_date DESC, created_at DESC LIMIT 60').all(),
    q('SELECT * FROM automations WHERE account_id = ? ORDER BY sort, created_at').all(),
    q('SELECT * FROM requests WHERE account_id = ? ORDER BY created_at DESC LIMIT 100').all(),
    q('SELECT * FROM documents WHERE account_id = ? ORDER BY created_at DESC').all(),
    q('SELECT * FROM invoices WHERE account_id = ? ORDER BY invoice_date DESC').all(),
    q('SELECT * FROM activity WHERE account_id = ? ORDER BY created_at DESC LIMIT 50').all(),
    q('SELECT id, email, name, role, last_login_at, (password_hash IS NOT NULL) AS active FROM users WHERE account_id = ?').all(),
    internal ? q('SELECT * FROM notes WHERE account_id = ? ORDER BY created_at DESC').all() : Promise.resolve({ results: [] }),
  ]);
  if (!account) throw new HttpError(404, 'Account not found.');
  const out = {
    account, stages: STAGES, approvals: approvals.results, reports: reports.results, automations: automations.results,
    requests: requests.results, documents: documents.results, invoices: invoices.results, activity: activity.results, users: users.results,
  };
  if (internal) out.notes = notes.results;
  return out;
}

async function clientAccountId(user) {
  if (!user.account_id) throw new HttpError(400, 'This login has no client account. Use the admin console.');
  return user.account_id;
}

async function decideApproval(req, env, user, approvalId) {
  const acct = await clientAccountId(user);
  const b = await readJson(req);
  const decision = b.decision === 'approve' ? 'approved' : b.decision === 'decline' ? 'declined' : null;
  if (!decision) throw new HttpError(400, 'Pick approve or decline.');
  const a = await env.DB.prepare('SELECT * FROM approvals WHERE id = ? AND account_id = ?').bind(approvalId, acct).first();
  if (!a) throw new HttpError(404, 'Not found.');
  if (a.status !== 'pending') throw new HttpError(409, 'Already decided.');
  await env.DB.prepare('UPDATE approvals SET status = ?, client_note = ?, decided_at = ?, decided_by = ? WHERE id = ?')
    .bind(decision, str(b.note, 1000), now(), user.email, approvalId).run();
  await logActivity(env.DB, acct, 'client', `${decision === 'approved' ? 'Approved' : 'Declined'}: ${a.title}`);
  return json({ ok: true });
}

async function createRequest(req, env, user) {
  const acct = await clientAccountId(user);
  const b = await readJson(req);
  const body = str(b.body, 4000);
  if (!body) throw new HttpError(400, 'Tell us what you need.');
  const urgency = ['Today, it’s urgent', 'This week', 'No rush'].includes(b.urgency) ? b.urgency : 'This week';
  const t = now();
  await env.DB.prepare('INSERT INTO requests (id, account_id, user_id, body, urgency, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id('req'), acct, user.id, body, urgency, 'Received', t, t).run();
  await logActivity(env.DB, acct, 'client', `New request (${urgency}): ${body.slice(0, 120)}`);
  return json({ ok: true });
}

async function setPause(req, env, user) {
  const acct = await clientAccountId(user);
  const b = await readJson(req);
  const paused = b.paused ? 1 : 0;
  await env.DB.prepare('UPDATE accounts SET paused = ? WHERE id = ?').bind(paused, acct).run();
  await logActivity(env.DB, acct, 'client', paused ? 'Paused everything' : 'Turned everything back on');
  return json({ ok: true, paused: !!paused });
}

// ---------- admin ----------
const ACCOUNT_FIELDS = {
  business_name: (v) => str(v, 200), contact_name: (v) => str(v, 200), phone: (v) => str(v, 40), industry: (v) => str(v, 100),
  plan: (v) => str(v, 100), plan_price_cents: (v) => (num(v) == null ? null : Math.round(num(v))), founding: (v) => (v ? 1 : 0),
  hours_included: (v) => num(v) ?? 0, hours_used: (v) => num(v) ?? 0, next_invoice_date: (v) => str(v, 20),
  next_step: (v) => str(v, 500), source: (v) => str(v, 100), paused: (v) => (v ? 1 : 0),
};

async function adminList(env) {
  const rows = await env.DB.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM approvals p WHERE p.account_id = a.id AND p.status = 'pending') AS pending_approvals,
      (SELECT COUNT(*) FROM requests r WHERE r.account_id = a.id AND r.status != 'Done') AS open_requests,
      (SELECT email FROM users u WHERE u.account_id = a.id ORDER BY created_at LIMIT 1) AS email,
      (SELECT MAX(last_login_at) FROM users u WHERE u.account_id = a.id) AS last_login_at,
      (SELECT MAX(created_at) FROM activity t WHERE t.account_id = a.id) AS last_activity_at
    FROM accounts a ORDER BY a.created_at DESC`).all();
  return json({ accounts: rows.results, stages: STAGES, all_stages: STAGE_KEYS });
}

async function adminCreateAccount(req, env, admin) {
  const b = await readJson(req);
  const business = str(b.business_name, 200);
  const email = (str(b.email, 254) || '').toLowerCase();
  if (!business) throw new HttpError(400, 'Business name is required.');
  if (!emailOk(email)) throw new HttpError(400, 'A valid email is required for the login.');
  if (await env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) throw new HttpError(409, 'That email already has a login.');
  const stage = STAGE_KEYS.includes(b.stage) ? b.stage : 'prospect';
  const aid = id('acc'), uid = id('usr'), t = now();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO accounts (id, business_name, contact_name, phone, industry, stage, stage_updated_at, plan, plan_price_cents, hours_included, next_step, source, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(aid, business, str(b.contact_name, 200), str(b.phone, 40), str(b.industry, 100), stage, t, str(b.plan, 100),
        num(b.plan_price_cents), num(b.hours_included) ?? 0, str(b.next_step, 500), str(b.source, 100) || 'admin', t),
    env.DB.prepare("INSERT INTO users (id, account_id, email, name, role, created_at) VALUES (?,?,?,?, 'client', ?)")
      .bind(uid, aid, email, str(b.contact_name, 200), t),
  ]);
  if (b.default_automations) {
    const defaults = [['Lead Catcher', 'Replies to website and social messages'], ['Quote Chaser', 'Follow-ups on day 2, 5 and 10'],
      ['Schedule', 'Confirmations and reminders'], ['Reviews', 'One ask after each job'], ['Invoices', 'Sends invoices, chases late ones']];
    await env.DB.batch(defaults.map((d, i) => env.DB.prepare('INSERT INTO automations (id, account_id, name, rule, level, status, sort, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(id('aut'), aid, d[0], d[1], 'Ask me', 'In setup', i, t)));
  }
  await logActivity(env.DB, aid, 'team', `Account created by ${admin.email}`);
  const token = await newInvite(env.DB, uid);
  return json({ ok: true, id: aid, setup_url: new URL('/portal/setup?token=' + token, req.url).toString() }, 201);
}

async function adminUpdateAccount(req, env, admin, aid) {
  const b = await readJson(req);
  const cur = await env.DB.prepare('SELECT * FROM accounts WHERE id = ?').bind(aid).first();
  if (!cur) throw new HttpError(404, 'Not found.');
  const sets = [], vals = [];
  for (const [k, fn] of Object.entries(ACCOUNT_FIELDS)) if (k in b) { sets.push(`${k} = ?`); vals.push(fn(b[k])); }
  if ('stage' in b) {
    if (!STAGE_KEYS.includes(b.stage)) throw new HttpError(400, 'Unknown stage.');
    if (b.stage !== cur.stage) {
      sets.push('stage = ?', 'stage_updated_at = ?'); vals.push(b.stage, now());
      const label = (STAGES.find((s) => s.key === b.stage) || { label: b.stage }).label;
      await logActivity(env.DB, aid, 'team', `Moved to: ${label}`);
    }
  }
  if (!sets.length) return json({ ok: true });
  await env.DB.prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, aid).run();
  return json({ ok: true });
}

async function adminDeleteAccount(env, aid) {
  await env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(aid).run();
  return json({ ok: true });
}

async function adminInvite(req, env, aid) {
  const b = await readJson(req).catch(() => ({}));
  let user;
  if (b.email) {
    const email = String(b.email).toLowerCase().trim();
    if (!emailOk(email)) throw new HttpError(400, 'Give a valid email.');
    user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (user && user.account_id !== aid) throw new HttpError(409, 'That email belongs to another account.');
    if (!user) {
      const uid = id('usr');
      await env.DB.prepare("INSERT INTO users (id, account_id, email, name, role, created_at) VALUES (?,?,?,?, 'client', ?)")
        .bind(uid, aid, email, str(b.name, 200), now()).run();
      user = { id: uid, email };
      await logActivity(env.DB, aid, 'team', `Added login for ${email}`);
    }
  } else {
    user = await env.DB.prepare('SELECT * FROM users WHERE account_id = ? ORDER BY created_at LIMIT 1').bind(aid).first();
    if (!user) throw new HttpError(404, 'This account has no login yet. Add an email.');
  }
  const token = await newInvite(env.DB, user.id);
  return json({ ok: true, email: user.email, setup_url: new URL('/portal/setup?token=' + token, req.url).toString(), expires_days: INVITE_DAYS });
}

// child records the admin can add/edit/delete
const CHILD = {
  approvals: { cols: { kind: (v) => str(v, 60) || 'ASK ME', title: (v) => str(v, 300), detail: (v) => str(v, 2000), status: (v) => (['pending', 'approved', 'declined'].includes(v) ? v : 'pending') }, required: ['title'], log: (r) => `Waiting on you: ${r.title}` },
  reports: { cols: { report_date: (v) => str(v, 20), summary: (v) => str(v, 500), needs_you: (v) => str(v, 2000), handled: (v) => str(v, 2000), call_back: (v) => str(v, 2000), system_check: (v) => str(v, 2000) }, required: ['report_date', 'summary'], log: (r) => `Morning report posted for ${r.report_date}` },
  automations: { cols: { name: (v) => str(v, 100), rule: (v) => str(v, 300), level: (v) => (LEVELS.includes(v) ? v : 'Ask me'), status: (v) => str(v, 40) || 'In setup', sort: (v) => num(v) ?? 0 }, required: ['name'], log: (r) => `Automation added: ${r.name}` },
  documents: { cols: { name: (v) => str(v, 200), meta: (v) => str(v, 300), url: (v) => { const s = str(v, 1000); return s && /^https:\/\//.test(s) ? s : null; } }, required: ['name'], log: (r) => `Document added: ${r.name}` },
  invoices: { cols: { invoice_date: (v) => str(v, 20), amount_cents: (v) => Math.round(num(v) ?? 0), status: (v) => (['Paid', 'Due', 'Overdue'].includes(v) ? v : 'Due'), url: (v) => { const s = str(v, 1000); return s && /^https:\/\//.test(s) ? s : null; } }, required: ['invoice_date'], log: null },
  notes: { cols: { body: (v) => str(v, 4000) }, required: ['body'], log: null },
  requests: { cols: { status: (v) => (['Received', 'In progress', 'Done'].includes(v) ? v : 'Received'), reply: (v) => str(v, 4000), hours: (v) => num(v) }, required: [], log: null, noCreate: true },
};

async function adminCreateChild(req, env, admin, aid, table) {
  const spec = CHILD[table];
  if (!spec || spec.noCreate) throw new HttpError(404, 'Not found.');
  if (!(await env.DB.prepare('SELECT 1 FROM accounts WHERE id = ?').bind(aid).first())) throw new HttpError(404, 'Account not found.');
  const b = await readJson(req);
  const row = {};
  for (const [k, fn] of Object.entries(spec.cols)) row[k] = fn(b[k]);
  for (const k of spec.required) if (row[k] == null) throw new HttpError(400, `${k.replace('_', ' ')} is required.`);
  if (table === 'notes') row.author = admin.email;
  const cols = Object.keys(row);
  await env.DB.prepare(`INSERT INTO ${table} (id, account_id, ${cols.join(', ')}, created_at) VALUES (?, ?, ${cols.map(() => '?').join(', ')}, ?)`)
    .bind(id(table.slice(0, 3)), aid, ...cols.map((c) => row[c]), now()).run();
  if (spec.log) await logActivity(env.DB, aid, 'team', spec.log(row));
  return json({ ok: true }, 201);
}

async function adminUpdateChild(req, env, table, rowId) {
  const spec = CHILD[table];
  if (!spec) throw new HttpError(404, 'Not found.');
  const b = await readJson(req);
  const sets = [], vals = [];
  for (const [k, fn] of Object.entries(spec.cols)) if (k in b) { sets.push(`${k} = ?`); vals.push(fn(b[k])); }
  if (!sets.length) return json({ ok: true });
  if (table === 'requests') { sets.push('updated_at = ?'); vals.push(now()); }
  const before = table === 'requests' ? await env.DB.prepare('SELECT * FROM requests WHERE id = ?').bind(rowId).first() : null;
  const r = await env.DB.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, rowId).run();
  if (!r.meta.changes) throw new HttpError(404, 'Not found.');
  if (before && 'status' in b && b.status !== before.status) await logActivity(env.DB, before.account_id, 'team', `Request marked ${b.status}: ${before.body.slice(0, 80)}`);
  if (before && 'hours' in b && num(b.hours) != null) {
    const delta = (num(b.hours) || 0) - (before.hours || 0);
    if (delta) await env.DB.prepare('UPDATE accounts SET hours_used = MAX(0, hours_used + ?) WHERE id = ?').bind(delta, before.account_id).run();
  }
  return json({ ok: true });
}

async function adminDeleteChild(env, table, rowId) {
  if (!CHILD[table] || table === 'requests') throw new HttpError(404, 'Not found.');
  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(rowId).run();
  return json({ ok: true });
}

// ---------- router ----------
async function api(req, env, url) {
  const p = url.pathname.replace(/^\/api\/portal/, '') || '/';
  const m = req.method;
  if (m !== 'GET' && m !== 'HEAD') {
    // CSRF: browsers always send Origin on cross-site POSTs; require it to match.
    const origin = req.headers.get('origin');
    if (origin && origin !== url.origin) throw new HttpError(403, 'Bad origin.');
  }
  if (p === '/login' && m === 'POST') return login(req, env);
  if (p === '/logout' && m === 'POST') return logout(req, env);
  if (p === '/setup' && m === 'POST') return setupPassword(req, env);
  if (p === '/setup' && m === 'GET') {
    const inv = await checkInvite(env, url.searchParams.get('token'));
    return json({ email: inv.email, name: inv.name, business: inv.business_name, role: inv.role });
  }
  if (p === '/bootstrap' && m === 'POST') return bootstrap(req, env);
  if (p === '/health') return json({ ok: true });

  const user = await requireUser(req, env);
  if (p === '/me') return json({ user: { email: user.email, name: user.name, role: user.role } });
  if (p === '/password' && m === 'POST') return changePassword(req, env, user);
  if (p === '/dashboard' && m === 'GET') return json({ user: { email: user.email, name: user.name, role: user.role }, ...(await accountBundle(env.DB, await clientAccountId(user))) });
  let r;
  if ((r = p.match(/^\/approvals\/([\w]+)$/)) && m === 'POST') return decideApproval(req, env, user, r[1]);
  if (p === '/requests' && m === 'POST') return createRequest(req, env, user);
  if (p === '/pause' && m === 'POST') return setPause(req, env, user);

  if (p.startsWith('/admin')) {
    if (user.role !== 'admin') throw new HttpError(403, 'Not allowed.');
    const a = p.slice(6);
    if (a === '/accounts' && m === 'GET') return adminList(env);
    if (a === '/accounts' && m === 'POST') return adminCreateAccount(req, env, user);
    if ((r = a.match(/^\/accounts\/(\w+)$/))) {
      if (m === 'GET') return json(await accountBundle(env.DB, r[1], { internal: true }));
      if (m === 'PATCH') return adminUpdateAccount(req, env, user, r[1]);
      if (m === 'DELETE') return adminDeleteAccount(env, r[1]);
    }
    if ((r = a.match(/^\/accounts\/(\w+)\/invite$/)) && m === 'POST') return adminInvite(req, env, r[1]);
    if ((r = a.match(/^\/accounts\/(\w+)\/(\w+)$/)) && m === 'POST') return adminCreateChild(req, env, user, r[1], r[2]);
    if ((r = a.match(/^\/(\w+)\/(\w+)$/))) {
      if (m === 'PATCH') return adminUpdateChild(req, env, r[1], r[2]);
      if (m === 'DELETE') return adminDeleteChild(env, r[1], r[2]);
    }
  }
  throw new HttpError(404, 'Not found.');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/api/portal')) return withHeaders(await api(req, env, url));
      if (url.pathname === '/portal/' ) return Response.redirect(new URL('/portal', url).toString(), 301);
      if (!url.pathname.startsWith('/portal')) return new Response('Not found', { status: 404 });
      const res = await env.ASSETS.fetch(req);
      const out = withHeaders(res);
      if ((out.headers.get('content-type') || '').includes('text/html')) out.headers.set('cache-control', 'no-store');
      return out;
    } catch (e) {
      if (e instanceof HttpError) return withHeaders(json({ error: e.message }, e.status));
      console.error(e);
      return withHeaders(json({ error: 'Something went wrong on our side. Try again in a minute.' }, 500));
    }
  },
};
