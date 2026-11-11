// Signed one-tap links for the owner: approve extra hours, decline them, mark
// an item done. The link carries what it does and when it expires, signed with
// a key derived from TOKEN_ENC_KEY, so it can't be altered or guessed.
// Opening a link only shows a confirmation page; nothing happens until the
// owner presses the button (mail scanners open links on their own).

const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
export const LINK_DAYS = 14;

async function key(env) {
  const secret = String(env.TOKEN_ENC_KEY || "").trim();
  if (secret.length < 32) throw new Error("TOKEN_ENC_KEY is not set");
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("minutesregained-links"), info: enc.encode("owner-links-v1") },
    base, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign", "verify"]
  );
}

export const origin = (env) => String(env.SITE_ORIGIN || "https://minutesregained.com").replace(/\/$/, "");

// payload: { t: type, id, a: action, ag: agentId }. Returns a full URL.
export async function makeLink(env, payload, now = new Date()) {
  const body = b64url(enc.encode(JSON.stringify({ ...payload, exp: now.getTime() + LINK_DAYS * 86400000 })));
  const sig = b64url(await crypto.subtle.sign("HMAC", await key(env), enc.encode(body)));
  return `${origin(env)}/b/${body}.${sig}`;
}

// The payload if the signature is good and it hasn't expired, else null.
export async function readLink(env, token, now = new Date()) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await key(env), fromB64url(sig), enc.encode(body)); } catch { return null; }
  if (!ok) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    return p.exp && p.exp > now.getTime() ? p : null;
  } catch { return null; }
}
