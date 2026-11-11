// Form protection: honeypot, too-fast submissions and a per-IP rate limit,
// with every decision logged to security_events for the twice-daily brief.

const WINDOW_MINUTES = 10;
const MAX_PER_WINDOW = 5;     // accepted submissions per IP per window, per form
const MIN_FILL_MS = 2500;     // humans don't fill a form in under 2.5 seconds

async function ipHash(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const salt = env.OPS_TOKEN || "minutes-regained";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + "|" + ip));
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function logSecurityEvent(env, { kind, path, hash }) {
  try {
    await env.DB.prepare(`INSERT INTO security_events (kind, path, ip_hash, created_at) VALUES (?, ?, ?, ?)`)
      .bind(kind, path, hash || null, new Date().toISOString()).run();
  } catch (err) {
    console.error("security log failed", err);
  }
}

// Returns { ok: true, hash } to continue, or { ok: false, kind, silent } to stop.
// "silent" means answer the bot with a normal-looking success so it learns nothing.
export async function screenSubmission(request, env, path, { honeypot, elapsedMs }, { windowMinutes = WINDOW_MINUTES, maxPerWindow = MAX_PER_WINDOW } = {}) {
  const hash = await ipHash(request, env);
  if (honeypot && String(honeypot).trim()) {
    await logSecurityEvent(env, { kind: "honeypot", path, hash });
    return { ok: false, kind: "honeypot", silent: true };
  }
  if (elapsedMs !== undefined && elapsedMs !== null && Number(elapsedMs) < MIN_FILL_MS) {
    await logSecurityEvent(env, { kind: "too_fast", path, hash });
    return { ok: false, kind: "too_fast", silent: true };
  }
  const since = new Date(Date.now() - windowMinutes * 60000).toISOString();
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM security_events WHERE ip_hash = ? AND path = ? AND kind = 'accepted' AND created_at >= ?`
  ).bind(hash, path, since).first();
  if (row && row.n >= maxPerWindow) {
    await logSecurityEvent(env, { kind: "rate_limited", path, hash });
    return { ok: false, kind: "rate_limited", silent: false };
  }
  return { ok: true, hash };
}

export async function securitySummary(env, sinceIso) {
  const { results } = await env.DB.prepare(
    `SELECT kind, path, COUNT(*) AS n FROM security_events WHERE created_at >= ? GROUP BY kind, path ORDER BY n DESC`
  ).bind(sinceIso).all();
  return results || [];
}

// ------------------------------------------------------------ admin gate --
// One place that decides whether an /api/admin request may proceed. Returns
// null to continue, or the Response to send back.
//  - Wrong passwords are counted per IP: after ADMIN_MAX_FAILS in the window the
//    IP is refused for the rest of it, right password or not (brute force).
//  - The password is compared in constant time.
//  - A browser already signed in to the dashboard sends its saved password with
//    every request to this site, including ones started by another site. So a
//    request that changes something must come from our own pages (cross-site
//    request forgery). Tools that send no Origin header (curl, scripts) pass.
export const ADMIN_MAX_FAILS = 10;
export const ADMIN_FAIL_WINDOW_MIN = 15;
const ADMIN_PATH = "/api/admin";

async function sameSecret(a, b) {
  const enc = new TextEncoder();
  const [x, y] = (await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))])).map((d) => new Uint8Array(d));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function adminGate(request, env) {
  const deny = (status, error, extra = {}) => new Response(status === 401 ? "Authentication required." : JSON.stringify({ error }), {
    status, headers: { "Cache-Control": "no-store", ...(status === 401 ? { "WWW-Authenticate": 'Basic realm="Minutes Regained CRM"' } : { "Content-Type": "application/json; charset=utf-8" }), ...extra },
  });
  const hash = await ipHash(request, env);
  const since = new Date(Date.now() - ADMIN_FAIL_WINDOW_MIN * 60000).toISOString();
  const fails = await env.DB.prepare(`SELECT COUNT(*) AS n FROM security_events WHERE ip_hash = ? AND path = ? AND kind = 'admin_fail' AND created_at >= ?`)
    .bind(hash, ADMIN_PATH, since).first().catch(() => null);
  if (fails && fails.n >= ADMIN_MAX_FAILS) return deny(429, "too_many_attempts", { "Retry-After": String(ADMIN_FAIL_WINDOW_MIN * 60) });

  const auth = request.headers.get("Authorization") || "";
  let given = null;
  if (auth.startsWith("Basic ")) { try { given = atob(auth.slice(6)); } catch { given = ""; } }
  const ok = !!env.ADMIN_PASSWORD && given !== null && await sameSecret(given, `admin:${env.ADMIN_PASSWORD}`);
  if (!ok) {
    // A first visit with no password yet is not an attempt; a wrong one is.
    if (given !== null) await logSecurityEvent(env, { kind: "admin_fail", path: ADMIN_PATH, hash });
    return deny(401, "unauthorized");
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("Origin");
    const site = request.headers.get("Sec-Fetch-Site");
    const own = new URL(request.url).origin;
    if ((origin && origin !== own) || (site && site !== "same-origin" && site !== "none")) {
      await logSecurityEvent(env, { kind: "admin_cross_site", path: ADMIN_PATH, hash });
      return deny(403, "cross_site_request");
    }
  }
  return null;
}
