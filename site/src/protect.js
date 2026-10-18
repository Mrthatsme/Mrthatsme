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
export async function screenSubmission(request, env, path, { honeypot, elapsedMs }) {
  const hash = await ipHash(request, env);
  if (honeypot && String(honeypot).trim()) {
    await logSecurityEvent(env, { kind: "honeypot", path, hash });
    return { ok: false, kind: "honeypot", silent: true };
  }
  if (elapsedMs !== undefined && elapsedMs !== null && Number(elapsedMs) < MIN_FILL_MS) {
    await logSecurityEvent(env, { kind: "too_fast", path, hash });
    return { ok: false, kind: "too_fast", silent: true };
  }
  const since = new Date(Date.now() - WINDOW_MINUTES * 60000).toISOString();
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM security_events WHERE ip_hash = ? AND path = ? AND kind = 'accepted' AND created_at >= ?`
  ).bind(hash, path, since).first();
  if (row && row.n >= MAX_PER_WINDOW) {
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
